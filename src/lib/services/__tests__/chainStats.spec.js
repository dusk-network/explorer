import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import { createFakeNode } from "$lib/mock-data/fakeNode";

import { createChainHead, createChainStats, duskAPI } from "..";
import { EPOCH } from "../chainStats";

/**
 * A provisioner of 1,000 DUSK, eligible from `eligibility`.
 *
 * @param {string} key
 * @param {number} eligibility
 */
const provisioner = (key, eligibility) => ({
  amount: 1e12,
  eligibility,
  faults: 0,
  // eslint-disable-next-line camelcase
  hard_faults: 0,
  key,
  // eslint-disable-next-line camelcase
  locked_amt: 0,
  owner: { Account: key },
  reward: 0,
});

describe("createChainStats", () => {
  /** @type {ReturnType<typeof createFakeNode>} */
  let node;

  /** @type {(() => void)[]} */
  let stops = [];

  /**
   * The numbers as a page shows them, over the node's socket.
   *
   * @param {(input: any, init?: any) => Promise<Response>} [fetch]
   */
  const showStats = (fetch = node.fetch) => {
    vi.stubGlobal("fetch", fetch);

    const head = createChainHead({
      interval: 10_000,
      linger: 0,
      read: () => duskAPI.getChainTip(),
    });
    const stats = createChainStats({
      api: {
        getProvisioners: () => duskAPI.getProvisioners(),
        getTxCount: () => duskAPI.getTxCount(),
      },
      head,
    });

    stops.push(stats.subscribe(() => {}));

    return stats;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    stops.forEach((stop) => stop());
    stops = [];
    await vi.advanceTimersByTimeAsync(1_000);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Ten seconds, then a block with `count` transactions. */
  const nextBlock = async (count = 0) => {
    await vi.advanceTimersByTimeAsync(10_000);
    node.mine(count);
    await vi.advanceTimersByTimeAsync(0);
  };

  it("should count the stakes again at each block, and read the provisioners only every five minutes", async () => {
    const tip = 1_000_000;

    node = createFakeNode({
      provisioners: [
        provisioner("a", 0),
        provisioner("b", tip + 3),
        provisioner("c", tip + 100_000),
      ],
      tip,
    });
    vi.stubGlobal("WebSocket", node.WebSocket);

    const stats = showStats();

    await vi.advanceTimersByTimeAsync(0);

    expect(get(stats).data).toMatchObject({
      activeProvisioners: 1,
      lastBlock: tip,
      waitingProvisioners: 2,
    });

    // Six minutes of blocks.
    for (let n = 1; n <= 36; n += 1) {
      await nextBlock();

      expect(get(stats).data?.lastBlock).toBe(node.tip);
      // "b" counts from its block on, without another read.
      expect(get(stats).data?.activeProvisioners).toBe(
        node.tip >= tip + 3 ? 2 : 1
      );
    }

    expect(node.requests("/on/node/provisioners")).toHaveLength(2);
  });

  it("should read the provisioners again when an epoch starts", async () => {
    const tip = EPOCH * 500 - 2;

    node = createFakeNode({ tip });
    vi.stubGlobal("WebSocket", node.WebSocket);
    showStats();
    await vi.advanceTimersByTimeAsync(0);

    await nextBlock();
    expect(node.requests("/on/node/provisioners")).toHaveLength(1);

    // The epoch's first block.
    await nextBlock();
    expect(node.requests("/on/node/provisioners")).toHaveLength(2);

    await nextBlock();
    expect(node.requests("/on/node/provisioners")).toHaveLength(2);
  });

  it("should read the transaction count again for a block with transactions, and only then", async () => {
    node = createFakeNode();
    vi.stubGlobal("WebSocket", node.WebSocket);

    const stats = showStats();

    await vi.advanceTimersByTimeAsync(0);

    const counted = get(stats).data?.txCount?.total ?? 0;

    await nextBlock();
    await nextBlock();
    expect(node.requests("/on/stats/tx_count")).toHaveLength(1);

    await nextBlock(2);
    expect(node.requests("/on/stats/tx_count")).toHaveLength(2);
    expect(get(stats).data?.txCount?.total).toBe(counted + 2);

    await nextBlock();
    expect(node.requests("/on/stats/tx_count")).toHaveLength(2);
  });

  it("should read the transaction count again after blocks it may have missed", async () => {
    node = createFakeNode();
    vi.stubGlobal("WebSocket", node.WebSocket);
    showStats();
    await vi.advanceTimersByTimeAsync(0);

    // A block the socket didn't bring, then one it did.
    const [socket] = node.sockets;

    node.sockets.delete(socket);
    node.mine(1);
    node.sockets.add(socket);
    await nextBlock();

    expect(node.requests("/on/stats/tx_count")).toHaveLength(2);
  });

  it("should leave out the stakes it can't read, and read them again at the next block", async () => {
    node = createFakeNode();
    vi.stubGlobal("WebSocket", node.WebSocket);

    let refuse = true;
    const stats = showStats(async (input, init) =>
      refuse && String(input).endsWith("/on/node/provisioners")
        ? new Response("", { status: 503 })
        : node.fetch(input, init)
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(get(stats).data).toStrictEqual({
      lastBlock: node.tip,
      lastBlockDate: expect.any(Date),
      txCount: { public: 0, shielded: 0, total: 0 },
    });

    refuse = false;
    await nextBlock();

    expect(get(stats).data).toMatchObject({
      activeProvisioners: expect.any(Number),
      lastBlock: node.tip,
    });
  });

  it("should read the transaction count again for a block with transactions that came during a read", async () => {
    node = createFakeNode();
    vi.stubGlobal("WebSocket", node.WebSocket);

    // Each count answers 15 seconds after it was asked, as it was then.
    const stats = showStats(async (input, init) => {
      const response = await node.fetch(input, init);

      if (String(input).endsWith("/on/stats/tx_count")) {
        await new Promise((done) => setTimeout(done, 15_000));
      }

      return response;
    });

    await vi.advanceTimersByTimeAsync(20_000);

    const counted = get(stats).data?.txCount?.total ?? 0;

    await nextBlock(2);
    // During the count's read.
    await nextBlock(1);
    await nextBlock();
    await nextBlock();
    await nextBlock();

    expect(get(stats).data?.txCount?.total).toBe(counted + 3);
  });
});
