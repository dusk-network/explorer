import { watchAcceptedBlocks } from "./nodeEvents";

/**
 * The chain's newest block, as a page following the chain knows it, and
 * when the page learned of it (`at`): when it was announced or read as it
 * came, at once; otherwise, as on opening or after a gap, at its own time,
 * no later than then.
 *
 * @typedef {{
 *   at: number,
 *   date: Date,
 *   hash: string,
 *   height: number,
 *   transactions: number | null,
 * }} ChainHead
 */

/**
 * @typedef {{
 *   date: Date,
 *   hash: string,
 *   height: number,
 *   transactions?: number | null,
 * }} ChainTip
 */

/**
 * @typedef {import("svelte/store").Readable<{
 *   error: Error | null,
 *   head: ChainHead | null,
 * }>} ChainHeadStore
 */

/** No block for this long over the socket, and the last block is read to check it. */
const QUIET_MS = 60_000;

/** The first wait before opening the socket again, doubled each time up to the last. */
const RECONNECT_MS = [30_000, 60_000, 120_000, 300_000];

/** How long a read may come after the one before it and still follow it. */
const SLACK_MS = 5_000;

/**
 * The chain's newest block for every page that follows it, one socket for
 * all of them: the node announces each block it accepts over its websocket.
 * Once a socket closed, or could not subscribe, the last block is read
 * every `interval` until a block comes over a socket again, opened half a
 * minute later, then less often. A socket quiet for a minute is checked
 * with one read of the last block. Nothing is asked while the page is
 * hidden: on showing again, the last block is read once.
 * It stops `linger` after its last subscriber left, so that going from one
 * page to the next keeps the socket.
 *
 * @param {{
 *   interval: number,
 *   linger?: number,
 *   now?: () => number,
 *   read: () => Promise<ChainTip>,
 *   watch?: typeof watchAcceptedBlocks,
 * }} options
 * @returns {ChainHeadStore}
 */
export function createChainHead({
  interval,
  linger = 5_000,
  now = Date.now,
  read,
  watch = watchAcceptedBlocks,
}) {
  /** @type {Set<(value: { error: Error | null, head: ChainHead | null }) => void>} */
  const runs = new Set();

  /** @type {{ error: Error | null, head: ChainHead | null }} */
  let value = { error: null, head: null };

  let running = false;

  /** When the last read or block came, for a poll that follows it. */
  let lastHeardAt = 0;

  /** Whether the page stopped hearing since then: hidden, or a read failed. */
  let gap = true;

  let reconnects = 0;

  /** Whether the last block is read on a timer: while no socket gives blocks. */
  let polling = false;

  /** @type {{ close: () => void } | null} */
  let socket = null;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let pollTimer;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let quietTimer;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let reconnectTimer;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let stopTimer;

  /** @param {{ error: Error | null, head: ChainHead | null }} next */
  const set = (next) => {
    value = next;
    runs.forEach((run) => run(value));
  };

  const isHidden = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden";

  /**
   * Takes a block as the newest, unless it is the one known, or an older
   * one than it: a node answering behind another.
   *
   * @param {ChainTip} tip
   * @param {boolean} asItCame Heard as it came: announced, or on a poll that
   *   follows the one before it
   */
  function take(tip, asItCame) {
    const arrived = now();
    const known = value.head;

    lastHeardAt = arrived;
    gap = false;

    if (known && (tip.hash === known.hash || tip.height < known.height)) {
      if (value.error) {
        set({ error: null, head: known });
      }

      return;
    }

    set({
      error: null,
      head: {
        at: asItCame ? arrived : Math.min(arrived, tip.date.getTime()),
        date: tip.date,
        hash: tip.hash,
        height: tip.height,
        transactions: tip.transactions ?? null,
      },
    });
  }

  /**
   * One read of the last block.
   *
   * @returns {Promise<ChainTip | null>}
   */
  async function readTip() {
    const following = !gap && now() - lastHeardAt <= interval + SLACK_MS;

    try {
      const tip = await read();

      if (running && !isHidden()) {
        take(tip, following);
      }

      return tip;
    } catch (error) {
      gap = true;

      if (running) {
        set({
          error: error instanceof Error ? error : new Error(String(error)),
          head: value.head,
        });
      }

      return null;
    }
  }

  /** Reads the last block every `interval`, until a block comes over a socket. */
  function startPolling() {
    if (!polling) {
      polling = true;
      nextPoll();
    }
  }

  function stopPolling() {
    polling = false;
    clearTimeout(pollTimer);
  }

  function nextPoll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      await readTip();

      if (polling && running && !isHidden()) {
        nextPoll();
      }
    }, interval);
  }

  function listenQuietly() {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(async () => {
      const known = value.head;
      const tip = await readTip();

      if (!running || !socket) {
        return;
      }

      // The chain moved and the socket said nothing: it is open no more.
      if (tip && known && tip.hash !== known.hash) {
        closeSocket();
        startPolling();
        reconnectLater();
      } else {
        listenQuietly();
      }
    }, QUIET_MS);
  }

  function closeSocket() {
    clearTimeout(quietTimer);
    socket?.close();
    socket = null;
  }

  function reconnectLater() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(
      openSocket,
      RECONNECT_MS[Math.min(reconnects, RECONNECT_MS.length - 1)]
    );
    reconnects += 1;
  }

  function openSocket() {
    clearTimeout(reconnectTimer);

    if (!running || isHidden() || socket) {
      return;
    }

    const opened = watch({
      onBlock: (block) => {
        if (socket !== opened || isHidden()) {
          return;
        }

        // The socket works: no more reads on a timer.
        stopPolling();
        reconnects = 0;
        take(
          {
            date: new Date(block.timestamp * 1000),
            hash: block.hash,
            height: block.height,
            transactions: block.transactions,
          },
          true
        );
        listenQuietly();
      },
      onClose: () => {
        if (socket !== opened) {
          return;
        }

        socket = null;
        clearTimeout(quietTimer);

        if (running && !isHidden()) {
          startPolling();
          reconnectLater();
        }
      },
    });

    socket = opened;
    listenQuietly();
  }

  /** Hears the chain again, after opening or a gap: one read, then the socket. */
  function wake() {
    gap = true;
    readTip();
    openSocket();
  }

  function rest() {
    gap = true;
    stopPolling();
    clearTimeout(reconnectTimer);
    closeSocket();
  }

  const onVisibility = () => (isHidden() ? rest() : wake());

  function start() {
    running = true;
    reconnects = 0;
    document.addEventListener("visibilitychange", onVisibility);

    if (!isHidden()) {
      wake();
    }
  }

  function stop() {
    running = false;
    document.removeEventListener("visibilitychange", onVisibility);
    rest();
  }

  return {
    subscribe(run) {
      runs.add(run);
      run(value);
      clearTimeout(stopTimer);

      if (!running) {
        start();
      }

      return () => {
        runs.delete(run);

        if (!runs.size) {
          clearTimeout(stopTimer);
          stopTimer = setTimeout(() => {
            if (!runs.size) {
              stop();
            }
          }, linger);
        }
      };
    },
  };
}
