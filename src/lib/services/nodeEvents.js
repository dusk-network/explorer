import { makeNodeUrl } from "$lib/url";

/**
 * A block the node accepted, as its event gives it.
 *
 * @typedef {{
 *   hash: string,
 *   height: number,
 *   timestamp: number,
 *   transactions: number,
 * }} AcceptedBlock
 */

/** The topic the node announces each block it accepts on. */
const ACCEPTED = /^\/on\/blocks:[0-9a-f]+\/accepted$/i;

const decoder = new TextDecoder();

/**
 * A block from one of the node's event frames: four bytes, little-endian,
 * for the length of its headers, the headers as JSON, then the block's
 * header and transaction IDs as JSON. Null for any other frame.
 *
 * @param {unknown} data
 * @returns {AcceptedBlock | null}
 */
export function acceptedBlockOf(data) {
  if (!(data instanceof ArrayBuffer) || data.byteLength < 4) {
    return null;
  }

  try {
    const length = new DataView(data).getUint32(0, true);
    const headers = JSON.parse(decoder.decode(new Uint8Array(data, 4, length)));
    const location = String(headers?.["Content-Location"] ?? "");

    if (!ACCEPTED.test(location)) {
      return null;
    }

    const { header, transactions } = JSON.parse(
      decoder.decode(new Uint8Array(data, 4 + length))
    );

    if (
      typeof header?.hash !== "string" ||
      !Number.isSafeInteger(header?.height) ||
      !Number.isSafeInteger(header?.timestamp)
    ) {
      return null;
    }

    return {
      hash: header.hash,
      height: header.height,
      timestamp: header.timestamp,
      transactions: Array.isArray(transactions) ? transactions.length : 0,
    };
  } catch {
    return null;
  }
}

/**
 * The blocks the node accepts, as it accepts them, over its websocket: the
 * socket opens, the node names its session, and the session subscribes to
 * accepted blocks. `onBlock` hears each block; `onClose` hears once that
 * the socket closed or the subscription was refused, unless `close()` came
 * first.
 *
 * @param {{
 *   onBlock: (block: AcceptedBlock) => void,
 *   onClose: () => void,
 * }} listeners
 * @returns {{ close: () => void }}
 */
export function watchAcceptedBlocks({ onBlock, onClose }) {
  const url = makeNodeUrl("/on");

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  let done = false;
  let subscribed = false;

  /** @type {WebSocket | null} */
  let socket = null;

  const finish = () => {
    if (done) {
      return;
    }

    done = true;

    try {
      socket?.close();
    } catch {
      // Closing already.
    }

    onClose();
  };

  try {
    socket = new WebSocket(url);
  } catch {
    queueMicrotask(finish);

    return {
      close() {
        done = true;
      },
    };
  }

  socket.binaryType = "arraybuffer";
  socket.addEventListener("close", finish);
  socket.addEventListener("error", finish);
  socket.addEventListener("message", (event) => {
    if (done) {
      return;
    }

    // The first frame names the session.
    if (!subscribed && typeof event.data === "string") {
      subscribed = true;
      fetch(makeNodeUrl("/on/blocks/accepted"), {
        headers: { "Rusk-Session-Id": event.data },
        method: "GET",
      }).then((response) => {
        response.body?.cancel().catch(() => {});

        if (!response.ok) {
          finish();
        }
      }, finish);

      return;
    }

    const block = acceptedBlockOf(event.data);

    if (block) {
      onBlock(block);
    }
  });

  return {
    close() {
      done = true;
      socket?.close();
    },
  };
}
