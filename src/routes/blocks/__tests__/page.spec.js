import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { duskAPI } from "$lib/services";
import { transformBlock } from "$lib/chain-info";
import { appStore, chainHeadStore } from "$lib/stores";
import { gqlBlocks } from "$lib/mock-data";
import { changeMediaQueryMatches } from "$lib/dusk/test-helpers";

import Blocks from "../+page.svelte";

// The chain's newest block, as the test gives it.
vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {import("$lib/stores")} */
  const original = await importOriginal();
  const { writable } = await import("svelte/store");

  return {
    ...original,
    chainHeadStore: writable({ error: null, head: null }),
  };
});

/** @type {import("svelte/store").Writable<{ error: Error | null, head: any }>} */
const head = /** @type {any} */ (chainHeadStore);

/** @param {number} height */
const newBlock = (height) =>
  head.set({
    error: null,
    head: {
      at: Date.now(),
      date: new Date(),
      hash: `h${height}`,
      height,
      transactions: 0,
    },
  });

describe("Blocks page", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const { blocksListEntries, fetchInterval } = get(appStore);
  const blocks = gqlBlocks.blocks.map(transformBlock);
  const newest = blocks[0].header.height;
  const getBlocksSpy = vi.spyOn(duskAPI, "getBlocks").mockResolvedValue(blocks);

  // The node has no block after the newest one.
  const getBlocksAfterSpy = vi
    .spyOn(duskAPI, "getBlocksAfter")
    .mockResolvedValue({ anchor: blocks[0].header.hash, blocks: [] });

  afterEach(() => {
    cleanup();
    getBlocksSpy.mockClear();
    getBlocksAfterSpy.mockClear();
  });

  afterAll(() => {
    vi.useRealTimers();
    getBlocksSpy.mockRestore();
    getBlocksAfterSpy.mockRestore();
    vi.doUnmock("$lib/stores");
  });

  it("should render the Blocks page, read the blocks again at each new block and only then, and stop when unmounted", async () => {
    const { container, unmount } = render(Blocks);

    // snapshost in loading state
    expect(container.firstElementChild).toMatchSnapshot();
    expect(getBlocksSpy).toHaveBeenCalledTimes(1);
    expect(getBlocksSpy).toHaveBeenNthCalledWith(1, blocksListEntries);

    await vi.advanceTimersByTimeAsync(1);

    // snapshot with received data from GraphQL
    expect(container.firstElementChild).toMatchSnapshot();

    // No new block: nothing more is read.
    await vi.advanceTimersByTimeAsync(fetchInterval * 3);
    expect(getBlocksAfterSpy).not.toHaveBeenCalled();

    newBlock(newest + 1);
    await vi.advanceTimersByTimeAsync(1);

    expect(getBlocksAfterSpy).toHaveBeenCalledTimes(1);
    expect(getBlocksAfterSpy).toHaveBeenNthCalledWith(
      1,
      newest,
      newest + blocksListEntries
    );

    newBlock(newest + 2);
    await vi.advanceTimersByTimeAsync(1);

    expect(getBlocksAfterSpy).toHaveBeenCalledTimes(2);
    expect(getBlocksSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".blocks-table tbody tr")).toHaveLength(
      Math.min(blocks.length, get(appStore).chainInfoEntries)
    );

    unmount();

    newBlock(newest + 3);
    await vi.advanceTimersByTimeAsync(fetchInterval * 10);

    expect(getBlocksAfterSpy).toHaveBeenCalledTimes(2);
    expect(getBlocksSpy).toHaveBeenCalledTimes(1);
  });

  it("should render the Blocks page with the mobile layout", async () => {
    const { container } = render(Blocks);

    changeMediaQueryMatches("(max-width: 1024px)", true);

    expect(get(appStore).isSmallScreen).toBe(true);

    expect(getBlocksSpy).toHaveBeenCalledTimes(1);
    expect(getBlocksSpy).toHaveBeenNthCalledWith(1, blocksListEntries);

    await vi.advanceTimersByTimeAsync(1);

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
