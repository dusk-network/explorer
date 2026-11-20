import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import * as mockData from "$lib/mock-data";
import { resolveAfter } from "$lib/dusk/promise";
import figure from "$lib/dusk/test-helpers/figure";
import { duskAPI } from "$lib/services";
import { appStore, chainHeadStore, chainStatsStore } from "$lib/stores";

import { StatisticsPanel } from "..";

const marketDataSettleTime = vi.hoisted(() => {
  vi.useFakeTimers();

  return 100;
});
// The price's move over 24 hours the market data gives, unless the
// mock data's.
const market = vi.hoisted(() => ({
  priceChange24h: /** @type {number | null} */ (null),
}));
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
      getMarketData: vi.fn(() =>
        resolveAfter(marketDataSettleTime, {
          circulatingSupply,
          currentPrice,
          marketCap,
          priceChange24h: market.priceChange24h ?? priceChange24h,
        }),
      ),
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
   * A number's card, found by its label: the labels' words are copy, what
   * each number is isn't.
   *
   * @param {HTMLElement} container
   * @param {RegExp} label
   */
  const cardOf = (container, label) =>
    Array.from(
      container.querySelectorAll(".statistics-panel__statistics-item"),
    ).find((card) => {
      const title = /** @type {Element | undefined} */ (
        card
          .querySelector(".statistics-panel__statistics-item-title")
          ?.cloneNode(true)
      );

      // The last block's label says whether new blocks come, after it.
      title?.querySelector(".statistics-panel__live")?.remove();

      return label.test(title?.textContent?.trim() ?? "");
    });

  /** @param {Element | undefined} card */
  const valueOf = (card) =>
    card
      ?.querySelector(".statistics-panel__statistics-item-value")
      ?.textContent?.replace(/\s+/g, " ")
      .trim();

  /** @param {Element | undefined} card */
  const noteOf = (card) =>
    card?.querySelector(".statistics-panel__statistics-item-note");

  it("should show no DUSK price or market cap on a test network, and both on mainnet", async () => {
    setChain(2);

    const { container } = render(StatisticsPanel);

    await act(() => newestBlock(mockData.apiStats.lastBlock));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    // Test DUSK has no value: no price, no market cap, no dollar figure.
    expect(cardOf(container, /price/i)).toBeUndefined();
    expect(cardOf(container, /market cap/i)).toBeUndefined();
    expect(container.textContent).not.toContain("$");

    await act(() => setChain(1));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    expect(valueOf(cardOf(container, /price/i))).toBe("$0.368");
    expect(valueOf(cardOf(container, /market cap/i))).toBe("$168.00M");
  });

  /** The time it takes the market data to be read again. */
  const nextRead = () =>
    vi.advanceTimersByTimeAsync(
      get(appStore).marketDataFetchInterval + marketDataSettleTime,
    );

  it("should give the price's move with its sign and colour, and the stake's share of the circulating supply", async () => {
    setChain(1);

    const { container } = render(StatisticsPanel);

    await act(() => newestBlock(mockData.apiStats.lastBlock));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    /** The price's move, and the colours it's given: one of the two. */
    const move = () => {
      const note = noteOf(cardOf(container, /price/i));

      return [
        note?.textContent?.replace(/\s+/g, " ").trim(),
        ["down", "up"].filter((way) =>
          note?.classList.contains(
            `statistics-panel__statistics-item-note--${way}`,
          ),
        ),
      ];
    };

    // -8.04817% in 24 hours: down, in red, to two decimals.
    expect(move()).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `^(?:Down ${figure("8.05%")}|${figure("−8.05%")}).*\\b24 ?h\\b`,
        ),
      ),
      ["down"],
    ]);
    // 58,226,174 DUSK staked of 457,027,796 in circulation.
    expect(
      noteOf(cardOf(container, /^(?!pending).*stake/i))?.textContent?.trim(),
    ).toMatch(new RegExp(`^${figure("12.7%")} of circulating supply$`));

    // A rise, read next: up, in green.
    market.priceChange24h = 8.04817;
    await nextRead();

    expect(move()).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `^(?:Up ${figure("8.05%")}|${figure("+8.05%")}).*\\b24 ?h\\b`,
        ),
      ),
      ["up"],
    ]);

    market.priceChange24h = null;
  });

  it("should warn by the price and the market cap once the market data is stale", async () => {
    setChain(1);

    const { container } = render(StatisticsPanel);
    const warned = (/** @type {RegExp} */ label) =>
      cardOf(container, label)?.querySelector(
        "[data-tooltip-type='warning']",
      ) != null;

    await nextRead();

    expect([warned(/price/i), warned(/market cap/i)]).toStrictEqual([
      false,
      false,
    ]);

    // The next read fails: what the two show is stale.
    vi.mocked(duskAPI.getMarketData).mockRejectedValueOnce(
      new Error("offline"),
    );
    await nextRead();

    expect([warned(/price/i), warned(/market cap/i)]).toStrictEqual([
      true,
      true,
    ]);
  });
});
