import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeNode } from "$lib/mock-data/fakeNode";

import { duskAPI } from "..";

const ACCOUNT = "account-a";

/**
 * A transaction ID: 64 hex digits.
 *
 * @param {number} n
 */
const idOf = (n) => n.toString(16).padStart(64, "0");

/**
 * An account's transfers, as the archive lists them.
 *
 * @param {{ height: number, origin: string }[]} sent
 * @param {{ height: number, origin: string }[]} received
 */
const historyOf = (sent, received) => new Map([[ACCOUNT, { received, sent }]]);

/**
 * Every transaction the account's history gives, page after page, newest
 * first, as the explorer lists them.
 *
 * @param {number} size
 */
async function readAll(size) {
  const history = duskAPI.accountHistory(ACCOUNT);
  const pages = [];

  for (let n = 0; n < 100; n += 1) {
    const page = await history.next(size);

    pages.push(page.transactions.map((tx) => tx.txid));

    if (page.done) {
      return pages;
    }
  }

  throw new Error("The history never ended");
}

/**
 * The transfers, newest block first, then by ID, each once: as a whole
 * history lists them, the other way round.
 *
 * @param {{ height: number, origin: string }[]} entries
 */
const newestFirst = (entries) =>
  [...new Map(entries.map((entry) => [entry.origin, entry])).values()]
    .sort((a, b) =>
      a.height === b.height
        ? a.origin.localeCompare(b.origin)
        : b.height - a.height
    )
    .map((entry) => entry.origin);

describe("duskAPI.accountHistory", () => {
  /** @type {ReturnType<typeof createFakeNode>} */
  let node;

  /** @param {Map<string, any>} history */
  const useNode = (history) => {
    node = createFakeNode({ history, tip: 4_736_000 });
    vi.stubGlobal("fetch", node.fetch);
  };

  const historyReads = () => node.requests("moonlightHistory");
  const detailReads = () => node.requests("tx");

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should give a small account's transactions newest first, a page at a time, from one read of its history", async () => {
    // 37 sent and 21 received over ten days, as user2's on testnet.
    const sent = Array.from({ length: 37 }, (_, n) => ({
      height: 4_650_000 + n * 2_300,
      origin: idOf(1_000 + n),
    }));
    const received = Array.from({ length: 21 }, (_, n) => ({
      height: 4_650_100 + n * 4_100,
      origin: idOf(2_000 + n),
    }));

    useNode(historyOf(sent, received));

    const history = duskAPI.accountHistory(ACCOUNT);
    const first = await history.next(25);

    expect(first.done).toBe(false);
    expect(first.transactions.map((tx) => tx.txid)).toStrictEqual(
      newestFirst([...sent, ...received]).slice(0, 25)
    );
    expect(historyReads()).toHaveLength(1);
    // Only that page's transactions.
    expect(detailReads()).toHaveLength(1);
    expect(detailReads()[0].body.match(/tx\d+: tx\(/g)).toHaveLength(25);

    const second = await history.next(25);

    expect(second.done).toBe(false);
    expect(second.transactions).toHaveLength(25);

    const third = await history.next(25);

    expect(third.done).toBe(true);
    expect(
      [
        ...first.transactions,
        ...second.transactions,
        ...third.transactions,
      ].map((tx) => tx.txid)
    ).toStrictEqual(newestFirst([...sent, ...received]));
    expect(historyReads()).toHaveLength(1);
  });

  it("should page a busy account from the last block down, newest first, with none left out and none twice", async () => {
    // 600 sent over the last 300,000 blocks, a crowded block of 120 sent
    // and 60 received among them, and 200 received in its last day.
    const sent = [
      ...Array.from({ length: 600 }, (_, n) => ({
        height: 4_436_000 + n * 500,
        origin: idOf(10_000 + n),
      })),
      ...Array.from({ length: 120 }, (_, n) => ({
        height: 4_600_250,
        origin: idOf(20_000 + n),
      })),
    ];
    const received = [
      ...Array.from({ length: 60 }, (_, n) => ({
        height: 4_600_250,
        origin: idOf(30_000 + n),
      })),
      ...Array.from({ length: 200 }, (_, n) => ({
        height: 4_727_400 + n * 40,
        origin: idOf(40_000 + n),
      })),
      // A transfer to itself, listed both ways.
      { height: 4_735_500, origin: idOf(10_599) },
    ];

    useNode(historyOf(sent, received));

    const pages = await readAll(25);

    expect(pages.flat()).toStrictEqual(newestFirst([...sent, ...received]));
    expect(pages.slice(0, -1).every((page) => page.length === 25)).toBe(true);
    // A page each, and the reads of history it took, spread over them.
    expect(detailReads()).toHaveLength(pages.length);
    expect(historyReads().length).toBeLessThan(pages.length);
  });

  it("should read the newest page of a busy account in a handful of reads of a page each, not its whole history", async () => {
    const sent = Array.from({ length: 5_000 }, (_, n) => ({
      height: 4_000_000 + n * 140,
      origin: idOf(50_000 + n),
    }));

    useNode(historyOf(sent, []));

    const first = await duskAPI.accountHistory(ACCOUNT).next(25);

    expect(first.transactions.map((tx) => tx.txid)).toStrictEqual(
      newestFirst(sent).slice(0, 25)
    );
    expect(historyReads().length).toBeLessThanOrEqual(6);
    // At most a page each way per read.
    expect(
      historyReads().every((read) =>
        [...read.body.matchAll(/maxCount: (\d+)/g)].every(([, n]) => n === "50")
      )
    ).toBe(true);
    expect(node.requests("fullMoonlightHistory")).toHaveLength(0);
  });

  it("should end at once for an account with no transfers", async () => {
    useNode(new Map());

    await expect(
      duskAPI.accountHistory(ACCOUNT).next(25)
    ).resolves.toStrictEqual({
      done: true,
      transactions: [],
    });
    expect(historyReads()).toHaveLength(1);
    expect(detailReads()).toHaveLength(0);
  });
});
