import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import { createFakeNode } from "$lib/mock-data/fakeNode";

import { createChainHead, duskAPI } from "..";

/**
 * Hides the page, or shows it again, as a browser does with a tab.
 *
 * @param {boolean} hidden
 */
const setHidden = (hidden) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("createChainHead", () => {
  const interval = 10_000;

  /** @type {ReturnType<typeof createFakeNode>} */
  let node;

  beforeEach(() => {
    vi.useFakeTimers();
    node = createFakeNode();
    vi.stubGlobal("fetch", node.fetch);
    vi.stubGlobal("WebSocket", node.WebSocket);
  });

  /** @type {(() => void)[]} */
  let stops = [];

  afterEach(async () => {
    // Every store stopped, after its linger, before the next test.
    stops.forEach((stop) => stop());
    stops = [];
    await vi.advanceTimersByTimeAsync(10_000);
    // @ts-ignore The own property set above, over jsdom's own.
    delete document.visibilityState;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const tipReads = () =>
    node.requests("block").filter((r) => r.body.includes("height: -1"));

  /** @param {Partial<Parameters<typeof createChainHead>[0]>} [options] */
  const follow = (options = {}) => {
    const head = createChainHead({
      interval,
      read: () => duskAPI.getChainTip(),
      ...options,
    });
    /** @type {any[]} */
    const seen = [];
    const unsubscribe = head.subscribe((value) => seen.push(value));
    let stopped = false;
    const stop = () => {
      if (!stopped) {
        stopped = true;
        unsubscribe();
      }
    };

    stops.push(stop);

    return { head, seen, stop };
  };

  it("should take each new block as the node announces it, from one socket, after one read of the last block", async () => {
    const { head, stop } = follow();

    await vi.advanceTimersByTimeAsync(100);

    expect(get(head).head?.height).toBe(node.tip);
    expect(node.log.filter((l) => l.method === "WS")).toHaveLength(1);
    expect(node.requests("/on/blocks/accepted")).toHaveLength(1);

    // Five minutes of blocks, one every ten seconds.
    for (let n = 0; n < 30; n += 1) {
      await vi.advanceTimersByTimeAsync(10_000);

      const block = node.mine(n % 10 === 0 ? 1 : 0);

      expect(get(head).head).toStrictEqual({
        at: Date.now(),
        date: new Date(block.timestamp * 1000),
        hash: block.hash,
        height: block.height,
        transactions: block.transactions.length,
      });
    }

    // The first read was the last.
    expect(tipReads()).toHaveLength(1);
    expect(node.log.filter((l) => l.method === "WS")).toHaveLength(1);

    stop();
  });

  it("should read the last block every interval while the node has no socket, and try the socket again later", async () => {
    vi.stubGlobal(
      "WebSocket",
      class extends node.WebSocket {
        /** @param {string | URL} url */
        constructor(url) {
          super(url);
          setTimeout(() => this.drop(), 0);
        }
      }
    );

    const { head, stop } = follow();

    await vi.advanceTimersByTimeAsync(0);

    expect(tipReads()).toHaveLength(1);

    for (let n = 1; n <= 6; n += 1) {
      node.mine();
      await vi.advanceTimersByTimeAsync(interval);

      // Each block within a read, as it came: at the read.
      expect(get(head).head?.height).toBe(node.tip);
      expect(get(head).head?.at).toBe(Date.now());
    }

    expect(tipReads()).toHaveLength(7);
    // Again after half a minute, then a minute.
    expect(node.log.filter((l) => l.method === "WS")).toHaveLength(2);

    stop();
  });

  it("should ask nothing while the page is hidden, and read the last block once when it shows again, dated by its own time", async () => {
    const { head, stop } = follow();

    await vi.advanceTimersByTimeAsync(100);
    node.mine();
    expect(get(head).head?.height).toBe(node.tip);

    setHidden(true);

    const asked = node.log.length;
    let last = node.mine();

    // The chain moves on, and stops, while the page is hidden.
    for (let n = 0; n < 10; n += 1) {
      await vi.advanceTimersByTimeAsync(10_000);
      last = node.mine();
    }
    await vi.advanceTimersByTimeAsync(4 * 60_000);

    expect(node.log.length).toBe(asked);
    expect(node.sockets.size).toBe(0);

    setHidden(false);
    await vi.advanceTimersByTimeAsync(100);

    expect(get(head).head?.height).toBe(last.height);
    // It came four minutes ago, not as the page showed again.
    expect(get(head).head?.at).toBe(last.timestamp * 1000);
    expect(tipReads()).toHaveLength(2);
    expect(node.sockets.size).toBe(1);

    stop();
  });

  it("should check a socket quiet for a minute with one read, and open another when the chain moved without it", async () => {
    const { head, stop } = follow();

    await vi.advanceTimersByTimeAsync(100);

    const [first] = node.sockets;

    // The socket goes quiet, without closing: the node announces nothing on it.
    node.sockets.delete(first);
    node.mine();
    node.mine();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(get(head).head?.height).toBe(node.tip);
    expect(tipReads()).toHaveLength(2);

    // Read on a timer until the socket opens again, half a minute on.
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(10);

    expect(tipReads()).toHaveLength(5);
    expect(node.sockets.size).toBe(1);

    node.mine();

    expect(get(head).head?.height).toBe(node.tip);

    stop();
  });

  it("should keep the newest block when a read gives an older one, as a node behind the others would", async () => {
    let behind = false;
    const { head, stop } = follow({
      read: async () => {
        const tip = await duskAPI.getChainTip();

        return behind ? { ...tip, hash: "older", height: tip.height - 2 } : tip;
      },
      watch: ({ onClose }) => {
        setTimeout(onClose, 0);

        return { close: () => {} };
      },
    });

    await vi.advanceTimersByTimeAsync(100);

    const newest = get(head).head;

    behind = true;
    await vi.advanceTimersByTimeAsync(interval);

    expect(get(head).head).toBe(newest);

    stop();
  });

  it("should stop once no page follows the chain, and not between two pages", async () => {
    const { head, stop } = follow();

    await vi.advanceTimersByTimeAsync(100);
    stop();

    // The next page follows it at once: the same socket.
    const next = head.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(10_000);
    expect(node.log.filter((l) => l.method === "WS")).toHaveLength(1);
    next();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(node.sockets.size).toBe(0);

    const asked = node.log.length;

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(node.log.length).toBe(asked);
  });
});
