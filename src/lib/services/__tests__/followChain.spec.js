import { describe, expect, it, vi } from "vitest";

import { followBlocks, followChainInfo, followTransactions } from "..";

/**
 * @param {string} txid
 * @param {number} blockheight
 * @param {string} [blockhash]
 */
const tx = (txid, blockheight, blockhash = `hash-${blockheight}`) =>
  /** @type {Transaction} */ ({ blockhash, blockheight, txid });

/**
 * @param {number} height
 * @param {string[]} [txids]
 * @param {string} [hash]
 * @param {string} [prevblockhash]
 */
const block = (
  height,
  txids = [],
  hash = `hash-${height}`,
  prevblockhash = `hash-${height - 1}`
) =>
  /** @type {Block} */ ({
    header: { hash, height, prevblockhash },
    transactions: { data: txids.map((txid) => tx(txid, height, hash)) },
  });

/** @param {{ header: { height: number } }[]} blocks */
const heights = (blocks) => blocks.map(({ header }) => header.height);

/** @param {Transaction[]} transactions */
const ids = (transactions) => transactions.map(({ txid }) => txid);

/**
 * A chain the node answers from: its blocks by height, up to `tip`.
 *
 * @param {number} tip
 * @param {Record<number, string[]>} [txs] Transaction IDs by height
 */
function makeChain(tip, txs = {}) {
  /** @type {Map<number, Block>} */
  const blocks = new Map();

  const chain = {
    /** @param {number} height @param {string[]} [txids] @param {string} [hash] */
    add(height, txids = [], hash = undefined) {
      const prev = blocks.get(height - 1)?.header.hash;

      blocks.set(height, block(height, txids, hash, prev));
      chain.tip = Math.max(chain.tip, height);
    },
    /** @param {number} from @param {number} to */
    between(from, to) {
      /** @type {Block[]} */
      const found = [];

      for (let h = Math.min(to, chain.tip); h >= from; h--) {
        const b = blocks.get(h);

        if (b) {
          found.push(b);
        }
      }

      return found;
    },
    /** @param {number} height */
    hashAt(height) {
      return (height <= chain.tip && blocks.get(height)?.header.hash) || null;
    },
    /** @param {number} amount */
    last(amount) {
      return chain.between(chain.tip - amount + 1, chain.tip);
    },
    /** @param {number} amount */
    lastTransactions(amount) {
      return chain
        .between(0, chain.tip)
        .flatMap((b) => b.transactions.data)
        .slice(0, amount);
    },
    tip: 0,
  };

  for (let h = 1; h <= tip; h++) {
    chain.add(h, txs[h] ?? []);
  }

  return chain;
}

/** @param {ReturnType<typeof makeChain>} chain */
const blocksReader = (chain) => ({
  getBlocks: vi.fn(async (/** @type {number} */ amount) => chain.last(amount)),
  getBlocksAfter: vi.fn(
    async (/** @type {number} */ from, /** @type {number} */ to) => ({
      anchor: chain.hashAt(from),
      blocks: chain.between(from + 1, to),
    })
  ),
  getLatestChainInfo: vi.fn(async (/** @type {number} */ amount) => ({
    blocks: chain.last(amount),
    transactions: chain.lastTransactions(amount),
  })),
});

/** @param {ReturnType<typeof makeChain>} chain */
const transactionsReader = (chain) => ({
  getChainTip: vi.fn(async () => ({
    date: new Date(0),
    ...(({ hash, height }) => ({ hash, height }))(
      chain.between(chain.tip, chain.tip)[0].header
    ),
  })),
  getTransactions: vi.fn(async (/** @type {number} */ amount) =>
    chain.lastTransactions(amount)
  ),
  getTransactionsAfter: vi.fn(
    async (/** @type {number} */ from, /** @type {number} */ to) => {
      const found = chain.between(from + 1, to);

      return {
        anchor: chain.hashAt(from),
        blocks: found.map(({ header }) => ({
          hash: header.hash,
          height: header.height,
          prevblockhash: header.prevblockhash,
        })),
        transactions: found.flatMap((b) => b.transactions.data),
      };
    }
  ),
});

describe("followBlocks", () => {
  it("should read the whole list once, then only the blocks after the newest it has", async () => {
    const chain = makeChain(10);
    const api = blocksReader(chain);
    const read = followBlocks(api);

    expect(heights(await read(5))).toStrictEqual([10, 9, 8, 7, 6]);
    expect(api.getBlocks).toHaveBeenCalledTimes(1);
    expect(api.getBlocks).toHaveBeenCalledWith(5);
    expect(api.getBlocksAfter).not.toHaveBeenCalled();

    chain.add(11);
    chain.add(12);

    expect(heights(await read(5))).toStrictEqual([12, 11, 10, 9, 8]);
    expect(api.getBlocksAfter).toHaveBeenCalledTimes(1);
    expect(api.getBlocksAfter).toHaveBeenLastCalledWith(10, 15);

    // Nothing new: the same blocks.
    expect(heights(await read(5))).toStrictEqual([12, 11, 10, 9, 8]);
    expect(api.getBlocksAfter).toHaveBeenLastCalledWith(12, 17);
    expect(api.getBlocks).toHaveBeenCalledTimes(1);
  });

  it("should give new objects on every read, so that rows are drawn again", async () => {
    const chain = makeChain(10);
    const read = followBlocks(blocksReader(chain));
    const first = await read(3);
    const second = await read(3);

    expect(second).toStrictEqual(first);
    second.forEach((b, i) => expect(b).not.toBe(first[i]));
  });

  it("should read the whole list again when the chain no longer has its newest block", async () => {
    const chain = makeChain(10);
    const api = blocksReader(chain);
    const read = followBlocks(api);

    await read(5);
    chain.add(10, [], "another-hash");
    chain.add(11);

    const blocks = await read(5);

    expect(heights(blocks)).toStrictEqual([11, 10, 9, 8, 7]);
    expect(blocks[1].header.hash).toBe("another-hash");
    expect(api.getBlocks).toHaveBeenCalledTimes(2);
  });

  it("should read the whole list again when the first block after its newest doesn't follow it", async () => {
    const chain = makeChain(10);
    const api = blocksReader(chain);
    const read = followBlocks(api);

    await read(5);

    // Block 10 was replaced between the two parts of the read.
    chain.add(10, [], "another-hash");
    chain.add(11);
    api.getBlocksAfter.mockResolvedValueOnce({
      anchor: "hash-10",
      blocks: chain.between(11, 15),
    });

    const blocks = await read(5);

    expect(heights(blocks)).toStrictEqual([11, 10, 9, 8, 7]);
    expect(blocks[1].header.hash).toBe("another-hash");
    expect(api.getBlocks).toHaveBeenCalledTimes(2);
  });

  it("should read the whole list again when more blocks came than a read takes", async () => {
    const chain = makeChain(10);
    const api = blocksReader(chain);
    const read = followBlocks(api);

    await read(5);

    for (let h = 11; h <= 30; h++) {
      chain.add(h);
    }

    expect(heights(await read(5))).toStrictEqual([30, 29, 28, 27, 26]);
    expect(api.getBlocksAfter).toHaveBeenCalledWith(10, 15);
    expect(api.getBlocks).toHaveBeenCalledTimes(2);
  });

  it("should read the whole list again after a failed read, or for another amount", async () => {
    const chain = makeChain(10);
    const api = blocksReader(chain);
    const read = followBlocks(api);

    await read(5);
    api.getBlocksAfter.mockRejectedValueOnce(new Error("offline"));

    await expect(read(5)).rejects.toThrow("offline");

    chain.add(11);

    expect(heights(await read(5))).toStrictEqual([11, 10, 9, 8, 7]);
    expect(api.getBlocks).toHaveBeenCalledTimes(2);

    expect(heights(await read(3))).toStrictEqual([11, 10, 9]);
    expect(api.getBlocks).toHaveBeenCalledTimes(3);
  });

  it("should start each read from the list the one before it left", async () => {
    const chain = makeChain(10);
    const api = blocksReader(chain);
    const read = followBlocks(api);

    await read(5);
    chain.add(11);

    const [a, b] = await Promise.all([read(5), read(5)]);

    expect(heights(a)).toStrictEqual([11, 10, 9, 8, 7]);
    expect(heights(b)).toStrictEqual([11, 10, 9, 8, 7]);
    expect(api.getBlocksAfter.mock.calls).toStrictEqual([
      [10, 15],
      [11, 16],
    ]);
  });
});

describe("followChainInfo", () => {
  it("should take the new transactions from the new blocks", async () => {
    const chain = makeChain(10, { 4: ["d1"], 7: ["g1", "g2"], 9: ["i1"] });
    const api = blocksReader(chain);
    const read = followChainInfo(api);
    const first = await read(3);

    expect(heights(first.blocks)).toStrictEqual([10, 9, 8]);
    expect(ids(first.transactions)).toStrictEqual(["i1", "g1", "g2"]);

    chain.add(11, ["k1", "k2"]);
    chain.add(12);

    const second = await read(3);

    expect(heights(second.blocks)).toStrictEqual([12, 11, 10]);
    expect(ids(second.transactions)).toStrictEqual(["k1", "k2", "i1"]);
    expect(api.getLatestChainInfo).toHaveBeenCalledTimes(1);
    expect(api.getBlocksAfter).toHaveBeenCalledWith(10, 13);
  });

  it("should add a block's transactions the first read's list missed", async () => {
    const chain = makeChain(10, { 7: ["g1"], 10: ["j1"] });
    const api = blocksReader(chain);

    // The transactions were read just before block 10.
    api.getLatestChainInfo.mockResolvedValueOnce({
      blocks: chain.last(3),
      transactions: [tx("g1", 7)],
    });

    const info = await followChainInfo(api)(3);

    expect(ids(info.transactions)).toStrictEqual(["j1", "g1"]);
  });

  it("should keep a transaction the first read had before its block once", async () => {
    const chain = makeChain(11, { 7: ["g1"], 11: ["k1"] });
    const api = blocksReader(chain);
    const read = followChainInfo(api);

    // The blocks were read just before block 11, the transactions after.
    api.getLatestChainInfo.mockResolvedValueOnce({
      blocks: chain.between(8, 10),
      transactions: chain.lastTransactions(3),
    });

    expect(ids((await read(3)).transactions)).toStrictEqual(["k1", "g1"]);

    const info = await read(3);

    expect(heights(info.blocks)).toStrictEqual([11, 10, 9]);
    expect(ids(info.transactions)).toStrictEqual(["k1", "g1"]);
  });

  it("should leave out the transactions of a block the blocks read replaced, and take the new block's", async () => {
    const chain = makeChain(10, { 9: ["i1"], 10: ["j1"] });
    const api = blocksReader(chain);
    const read = followChainInfo(api);

    // The transactions were read before block 10 was replaced, the blocks after.
    const transactions = chain.lastTransactions(3);

    chain.add(10, ["j2"], "another-hash");
    api.getLatestChainInfo.mockResolvedValueOnce({
      blocks: chain.last(3),
      transactions,
    });

    expect(ids((await read(3)).transactions)).toStrictEqual(["j2", "i1"]);

    // The next blocks follow the new block 10: nothing is read again.
    chain.add(11);

    expect(ids((await read(3)).transactions)).toStrictEqual(["j2", "i1"]);
    expect(api.getLatestChainInfo).toHaveBeenCalledTimes(1);
  });

  it("should read the whole lists again when the chain no longer has its newest block", async () => {
    const chain = makeChain(10, { 9: ["i1"] });
    const api = blocksReader(chain);
    const read = followChainInfo(api);

    await read(3);
    chain.add(10, ["j2"], "another-hash");

    const info = await read(3);

    expect(ids(info.transactions)).toStrictEqual(["j2", "i1"]);
    expect(api.getLatestChainInfo).toHaveBeenCalledTimes(2);
  });
});

describe("followTransactions", () => {
  it("should read the last block, then the whole list, then only the transactions after that block", async () => {
    const chain = makeChain(10, { 3: ["c1"], 6: ["f1", "f2"], 9: ["i1"] });
    const api = transactionsReader(chain);
    const read = followTransactions(api);

    expect(ids(await read(3))).toStrictEqual(["i1", "f1", "f2"]);
    expect(api.getChainTip.mock.invocationCallOrder[0]).toBeLessThan(
      api.getTransactions.mock.invocationCallOrder[0]
    );

    chain.add(11, ["k1"]);
    chain.add(12);

    expect(ids(await read(3))).toStrictEqual(["k1", "i1", "f1"]);
    expect(api.getTransactionsAfter).toHaveBeenLastCalledWith(10, 209);

    chain.add(13, ["m1"]);

    expect(ids(await read(3))).toStrictEqual(["m1", "k1", "i1"]);
    expect(api.getTransactionsAfter).toHaveBeenLastCalledWith(12, 211);
    expect(api.getTransactions).toHaveBeenCalledTimes(1);
  });

  it("should keep a transaction read after the last block once", async () => {
    const chain = makeChain(11, { 9: ["i1"], 11: ["k1"] });
    const api = transactionsReader(chain);
    const read = followTransactions(api);

    // The last block was read before block 11, the transactions after it.
    api.getChainTip.mockResolvedValueOnce({
      date: new Date(0),
      hash: "hash-10",
      height: 10,
    });

    expect(ids(await read(3))).toStrictEqual(["k1", "i1"]);
    expect(ids(await read(3))).toStrictEqual(["k1", "i1"]);
  });

  it("should read the whole list again when the chain no longer has the last block it saw", async () => {
    const chain = makeChain(10, { 9: ["i1"] });
    const api = transactionsReader(chain);
    const read = followTransactions(api);

    await read(3);
    chain.add(10, ["j1"], "another-hash");

    expect(ids(await read(3))).toStrictEqual(["j1", "i1"]);
    expect(api.getTransactions).toHaveBeenCalledTimes(2);
  });

  it("should read the whole list again when the first block after the last it saw doesn't follow it", async () => {
    const chain = makeChain(10, { 9: ["i1"] });
    const api = transactionsReader(chain);
    const read = followTransactions(api);

    await read(3);

    // Block 10 was replaced between the two parts of the read.
    chain.add(10, ["j1"], "another-hash");
    chain.add(11, ["k1"]);
    api.getTransactionsAfter.mockResolvedValueOnce({
      anchor: "hash-10",
      blocks: [{ hash: "hash-11", height: 11, prevblockhash: "another-hash" }],
      transactions: [tx("k1", 11)],
    });

    expect(ids(await read(3))).toStrictEqual(["k1", "j1", "i1"]);
    expect(api.getTransactions).toHaveBeenCalledTimes(2);
  });

  it("should read the whole list again when more blocks came than a read takes", async () => {
    const chain = makeChain(10, { 9: ["i1"] });
    const api = transactionsReader(chain);
    const read = followTransactions(api);

    await read(3);

    for (let h = 11; h <= 400; h++) {
      chain.add(h, h === 400 ? ["x1"] : []);
    }

    expect(ids(await read(3))).toStrictEqual(["x1", "i1"]);
    expect(api.getTransactions).toHaveBeenCalledTimes(2);
  });

  it("should read the whole list again after a failed read", async () => {
    const chain = makeChain(10, { 9: ["i1"] });
    const api = transactionsReader(chain);
    const read = followTransactions(api);

    await read(3);
    api.getTransactionsAfter.mockRejectedValueOnce(new Error("offline"));

    await expect(read(3)).rejects.toThrow("offline");
    expect(ids(await read(3))).toStrictEqual(["i1"]);
    expect(api.getTransactions).toHaveBeenCalledTimes(2);
  });
});
