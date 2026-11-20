import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import * as mockData from "$lib/mock-data";
import { resolveAfter } from "$lib/dusk/promise";
import { appStore, chainHeadStore, chainStatsStore } from "$lib/stores";

import { StatisticsPanel } from "..";

const marketDataSettleTime = vi.hoisted(() => {
  vi.useFakeTimers();

  return 100;
});
// The numbers, without drawing the map's countries.
vi.mock("$lib/components", async (importOriginal) => {
  /** @type {import("$lib/components")} */
  const original = await importOriginal();
  const { default: WorldMapStub } =
    await import("./test-components/WorldMapStub.svelte");

  return { ...original, WorldMap: WorldMapStub };
});
vi.mock("$lib/services", async (importOriginal) => {
  /** @type {import("$lib/services")} */
  const original = await importOriginal();
  const { apiMarketData, nodeLocationsCount } = await import("$lib/mock-data");
  const {
    circulating_supply: circulatingSupply,
    current_price: currentPrice,
    market_cap: marketCap,
    price_change_percentage_24h_in_currency: { usd: priceChange24h },
  } = apiMarketData.market_data;

  return {
    ...original,
    duskAPI: {
      ...original.duskAPI,
      getMarketData: () =>
        resolveAfter(marketDataSettleTime, {
          circulatingSupply,
          currentPrice,
          marketCap,
          priceChange24h,
        }),
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

/** @type {import("svelte/store").Writable<{ data: Stats | null, error: Error | null }>} */
const stats = /** @type {any} */ (chainStatsStore);

/**
 * The chain's newest block, `ago` milliseconds since the page learned of it.
 *
 * @param {number} height
 * @param {number} [ago]
 */
const newestBlock = (height, ago = 0) => {
  const at = Date.now() - ago;

  head.set({
    error: null,
    head: {
      at,
      date: new Date(at),
      hash: `h${height}`,
      height,
      transactions: 0,
    },
  });
  stats.set({
    data: {
      ...mockData.apiStats,
      lastBlock: height,
      lastBlockDate: new Date(at),
    },
    error: null,
  });
};

describe("StatisticsPanel", () => {
  afterEach(() => {
    cleanup();
    head.set({ error: null, head: null });
    stats.set({ data: null, error: null });
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/components");
    vi.doUnmock("$lib/services");
    vi.doUnmock("$lib/stores");
  });

  /** @param {number} chainId */
  const setChain = (chainId) =>
    appStore.setNodeInfo({
      ...get(appStore).nodeInfo,
      chain_id: chainId,
    });

  /**
   * The line under each of the four numbers that lead.
   *
   * @param {HTMLElement} container
   */
  const notesOf = (container) =>
    Array.from(
      container.querySelectorAll(".statistics-panel__statistics-item--primary"),
      (card) => card.querySelector(".statistics-panel__statistics-item-note"),
    );

  it("should show no DUSK price or market cap on a test network, and both on mainnet", async () => {
    setChain(2);

    const { container } = render(StatisticsPanel);

    await act(() => newestBlock(mockData.apiStats.lastBlock));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    // Test DUSK has no value: no dollar figure anywhere.
    expect(container.textContent).not.toContain("$");

    await act(() => setChain(1));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    expect(container.textContent).toContain("$");
  });

  it("should give the price's move with its sign, and the stake's share of the circulating supply", async () => {
    setChain(1);

    const { container } = render(StatisticsPanel);

    await act(() => newestBlock(mockData.apiStats.lastBlock));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    const [price, stake] = notesOf(container);

    // -8.04817% in 24 hours: down, to two decimals.
    expect(price).toHaveTextContent(/^(?:Down |[−-])8\.05%/);
    expect(price).toHaveClass("statistics-panel__statistics-item-note--down");
    expect(price).not.toHaveClass("statistics-panel__statistics-item-note--up");
    // 58,226,174 DUSK staked of 457,027,796 in circulation.
    expect(stake).toHaveTextContent(/^12\.7%/);
  });
});
