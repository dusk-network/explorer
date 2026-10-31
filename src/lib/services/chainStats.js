import { calculateStats } from "$lib/chain-info";

/** Blocks in an epoch: a stake counts from the start of one. */
export const EPOCH = 2160;

/** How long the provisioners read stay the ones counted. */
export const PROVISIONERS_MS = 5 * 60_000;

/**
 * @typedef {{
 *   getProvisioners: () => Promise<HostProvisioner[]>,
 *   getTxCount: () => Promise<{ public: number, shielded: number, total: number }>,
 * }} StatsReader
 */

/**
 * @typedef {import("svelte/store").Readable<{
 *   data: Stats | null,
 *   error: Error | null,
 * }>} ChainStatsStore
 */

/**
 * The network's numbers, as the chain's newest block makes them: the
 * stakes counted again at each block from the provisioners, which are read
 * every five minutes and when an epoch starts; the transaction count read
 * again for a block with transactions, or one that may have had some, as
 * after a gap. Provisioners or a count that can't be read leave out only
 * their own numbers, and are read again at the next block.
 *
 * @param {{
 *   api: StatsReader,
 *   head: import("./chainHead").ChainHeadStore,
 *   now?: () => number,
 * }} options
 * @returns {ChainStatsStore}
 */
export function createChainStats({ api, head, now = Date.now }) {
  /** @type {Set<(value: { data: Stats | null, error: Error | null }) => void>} */
  const runs = new Set();

  /** @type {{ data: Stats | null, error: Error | null }} */
  let value = { data: null, error: null };

  /** @type {(() => void) | null} */
  let unsubscribe = null;

  /** @type {{ at: number, height: number, list: HostProvisioner[] } | null} */
  let provisioners = null;

  /** @type {Stats["txCount"]} */
  let txCount;

  /** @type {Promise<void> | null} */
  let provisionersRead = null;

  /** @type {Promise<void> | null} */
  let countRead = null;

  /** Whether the count is read again once the read under way ends. */
  let countAgain = false;

  /** The newest block counted. */
  let counted = /** @type {import("./chainHead").ChainHead | null} */ (null);

  /** Each start is a run of its own: reads of a stopped one are dropped. */
  let run = 0;

  /** @param {{ data: Stats | null, error: Error | null }} next */
  const set = (next) => {
    value = next;
    runs.forEach((each) => each(value));
  };

  /** The numbers for the newest block, from what is read so far. */
  function show() {
    if (!counted) {
      return;
    }

    set({
      data: {
        ...(provisioners
          ? calculateStats(provisioners.list, counted.height)
          : { lastBlock: counted.height }),
        lastBlockDate: counted.date,
        txCount,
      },
      error: null,
    });
  }

  /** @param {number} height */
  function readProvisioners(height) {
    const mine = run;

    provisionersRead ??= api
      .getProvisioners()
      .then(
        (list) => {
          if (mine === run) {
            provisioners = { at: now(), height, list };
          }
        },
        () => {
          // Left out, and read again at the next block.
        }
      )
      .finally(() => {
        provisionersRead = null;

        if (mine === run) {
          show();
        }
      });
  }

  function readCount() {
    const mine = run;

    // A block with transactions during a read: it may not count them, so
    // the count is read again after it.
    if (countRead) {
      countAgain = true;

      return;
    }

    countAgain = false;
    countRead = api
      .getTxCount()
      .then(
        (count) => {
          if (mine === run) {
            txCount = count;
          }
        },
        () => {
          if (mine === run) {
            txCount = undefined;
          }
        }
      )
      .finally(() => {
        countRead = null;

        if (mine === run) {
          show();

          if (countAgain) {
            readCount();
          }
        }
      });
  }

  /** @param {import("./chainHead").ChainHead} newest */
  function follow(newest) {
    const before = counted;

    counted = newest;

    const stale =
      !provisioners ||
      now() - provisioners.at >= PROVISIONERS_MS ||
      Math.floor(newest.height / EPOCH) !==
        Math.floor(provisioners.height / EPOCH);

    if (stale) {
      readProvisioners(newest.height);
    }

    // One block after the one before: its own transactions say whether
    // the count moved. Anything else may have had some.
    const next = before !== null && newest.height === before.height + 1;

    if (stale || txCount === undefined || !next || newest.transactions !== 0) {
      readCount();
    }

    show();
  }

  function start() {
    run += 1;
    unsubscribe = head.subscribe(({ error, head: newest }) => {
      if (error) {
        set({ data: null, error });
      } else if (newest && newest.hash !== counted?.hash) {
        follow(newest);
      } else if (newest && value.error) {
        show();
      }
    });
  }

  // What was read stays for the next page that shows the numbers: the
  // provisioners as long as they are fresh, the rest until the next block.
  function stop() {
    run += 1;
    unsubscribe?.();
    unsubscribe = null;
    counted = null;
  }

  return {
    subscribe(each) {
      runs.add(each);
      each(value);

      if (runs.size === 1) {
        start();
      }

      return () => {
        runs.delete(each);

        if (!runs.size) {
          stop();
        }
      };
    },
  };
}
