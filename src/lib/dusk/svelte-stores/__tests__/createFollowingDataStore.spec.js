import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, writable } from "svelte/store";

import { createFollowingDataStore } from "..";

describe("createFollowingDataStore", () => {
  /** The chain's height the reads see as they begin. */
  let height = 1;

  /** A read that takes a second, of the height as it began. */
  const retriever = vi.fn(async () => {
    const seen = height;

    await new Promise((done) => setTimeout(done, 1_000));

    return seen;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    height = 1;
    retriever.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should take the block known as it starts as read by its first read", async () => {
    const head = writable({ head: { hash: "b1" } });
    const store = createFollowingDataStore(retriever, head);

    store.start();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(retriever).toHaveBeenCalledTimes(1);
    expect(get(store).data).toBe(1);

    store.stop();
  });

  it("should read again for a first block heard while its first read is under way", async () => {
    /** @type {import("svelte/store").Writable<{ head: { hash: string } | null }>} */
    const head = writable({ head: null });
    const store = createFollowingDataStore(retriever, head);

    store.start();
    await vi.advanceTimersByTimeAsync(500);

    // A block the first read began too early to see.
    height = 2;
    head.set({ head: { hash: "b2" } });
    await vi.advanceTimersByTimeAsync(2_000);

    expect(retriever).toHaveBeenCalledTimes(2);
    expect(get(store).data).toBe(2);

    store.stop();
  });
});
