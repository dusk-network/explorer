import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { resolveAfter } from "$lib/dusk/promise";
import { duskAPI } from "$lib/services";

import { appStore, chainHeadStore } from "$lib/stores";
import * as mockData from "$lib/mock-data";

import HomePage from "../+page.svelte";

const marketDataSettleTime = vi.hoisted(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  return 100;
});
vi.mock("$lib/services", async (importOriginal) => {
  /** @type {import("$lib/services")} */
  const original = await importOriginal();
  const { transformBlock, transformTransaction } =
    await import("$lib/chain-info");
  const { apiMarketData, gqlLatestChainInfo, nodeLocationsCount } =
    await import("$lib/mock-data");
  const { current_price: currentPrice, market_cap: marketCap } =
    apiMarketData.market_data;

  return {
    ...original,
    duskAPI: {
      ...original.duskAPI,

      // The node has no block after the newest one.
      getBlocksAfter: vi.fn().mockResolvedValue({
        anchor: gqlLatestChainInfo.blocks[0].header.hash,
        blocks: [],
      }),
      getLatestChainInfo: vi.fn().mockResolvedValue({
        blocks: gqlLatestChainInfo.blocks.map(transformBlock),
        transactions: gqlLatestChainInfo.transactions.map(transformTransaction),
      }),
      getMarketData: () =>
        resolveAfter(marketDataSettleTime, { currentPrice, marketCap }),
      getNodeLocations: vi.fn().mockResolvedValue(nodeLocationsCount),
    },
  };
});

// The chain's newest block and the numbers, as the test gives them.
vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {import("$lib/stores")} */
  const original = await importOriginal();
  const { writable } = await import("svelte/store");

  return {
    ...original,
    chainHeadStore: writable({ error: null, head: null }),
    chainStatsStore: writable({ data: null, error: null }),
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

describe("home page", () => {
  const { chainInfoEntries, fetchInterval } = get(appStore);
  const newest = mockData.gqlLatestChainInfo.blocks[0].header.height;

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/services");
    vi.doUnmock("$lib/stores");
  });

  it("should render the home page, read the latest chain info again at each new block and only then, and stop when it is destroyed", async () => {
    const { container, unmount } = render(HomePage);

    // snapshost in loading state
    expect(container.firstElementChild).toMatchSnapshot();
    expect(duskAPI.getLatestChainInfo).toHaveBeenCalledTimes(1);
    expect(duskAPI.getLatestChainInfo).toHaveBeenNthCalledWith(
      1,
      chainInfoEntries
    );

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    // snapshot with received data from GraphQL
    expect(container.firstElementChild).toMatchSnapshot();

    // No new block: nothing more is read.
    await vi.advanceTimersByTimeAsync(fetchInterval * 3);
    expect(duskAPI.getBlocksAfter).not.toHaveBeenCalled();

    // Then only the blocks after the newest one, at each new block.
    newBlock(newest + 1);
    await vi.advanceTimersByTimeAsync(1);

    expect(duskAPI.getBlocksAfter).toHaveBeenCalledTimes(1);
    expect(duskAPI.getBlocksAfter).toHaveBeenNthCalledWith(
      1,
      newest,
      newest + chainInfoEntries
    );

    newBlock(newest + 2);
    await vi.advanceTimersByTimeAsync(1);

    expect(duskAPI.getBlocksAfter).toHaveBeenCalledTimes(2);
    expect(duskAPI.getLatestChainInfo).toHaveBeenCalledTimes(1);

    unmount();

    newBlock(newest + 3);
    await vi.advanceTimersByTimeAsync(fetchInterval * 10);

    expect(duskAPI.getBlocksAfter).toHaveBeenCalledTimes(2);
    expect(duskAPI.getLatestChainInfo).toHaveBeenCalledTimes(1);
  }, 15000);
});
