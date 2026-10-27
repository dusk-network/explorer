import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { duskAPI } from "$lib/services";
import { transformBlock } from "$lib/chain-info";
import { appStore } from "$lib/stores";
import { gqlBlocks } from "$lib/mock-data";
import { changeMediaQueryMatches } from "$lib/dusk/test-helpers";

import Blocks from "../+page.svelte";

describe("Blocks page", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const { blocksListEntries, fetchInterval } = get(appStore);
  const blocks = gqlBlocks.blocks.map(transformBlock);
  const newest = blocks[0].header.height;
  const getBlocksSpy = vi.spyOn(duskAPI, "getBlocks").mockResolvedValue(blocks);

  // The node has no block after the newest one.
  const getBlocksInRangeSpy = vi
    .spyOn(duskAPI, "getBlocksInRange")
    .mockResolvedValue([blocks[0]]);

  afterEach(() => {
    cleanup();
    getBlocksSpy.mockClear();
    getBlocksInRangeSpy.mockClear();
  });

  afterAll(() => {
    vi.useRealTimers();
    getBlocksSpy.mockRestore();
    getBlocksInRangeSpy.mockRestore();
  });

  it("should render the Blocks page, start polling for blocks and stop the polling when unmounted", async () => {
    const { container, unmount } = render(Blocks);

    // snapshost in loading state
    expect(container.firstElementChild).toMatchSnapshot();
    expect(getBlocksSpy).toHaveBeenCalledTimes(1);
    expect(getBlocksSpy).toHaveBeenNthCalledWith(1, blocksListEntries);

    await vi.advanceTimersByTimeAsync(1);

    // snapshot with received data from GraphQL
    expect(container.firstElementChild).toMatchSnapshot();

    await vi.advanceTimersByTimeAsync(fetchInterval - 1);

    expect(getBlocksInRangeSpy).toHaveBeenCalledTimes(1);
    expect(getBlocksInRangeSpy).toHaveBeenNthCalledWith(
      1,
      newest,
      newest + blocksListEntries
    );

    await vi.advanceTimersByTimeAsync(fetchInterval);

    expect(getBlocksInRangeSpy).toHaveBeenCalledTimes(2);
    expect(getBlocksSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".blocks-table tbody tr")).toHaveLength(
      Math.min(blocks.length, get(appStore).chainInfoEntries)
    );

    unmount();

    await vi.advanceTimersByTimeAsync(fetchInterval * 10);

    expect(getBlocksInRangeSpy).toHaveBeenCalledTimes(2);
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
