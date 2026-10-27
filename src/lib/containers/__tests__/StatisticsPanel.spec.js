import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import * as mockData from "$lib/mock-data";
import { resolveAfter } from "$lib/dusk/promise";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

import { StatisticsPanel } from "..";

const marketDataSettleTime = vi.hoisted(() => {
  vi.useFakeTimers();

  return 100;
});
// The map's countries are drawn in full on the home page's snapshot.
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
  const { apiMarketData, apiStats, nodeLocationsCount } =
    await import("$lib/mock-data");
  const { current_price: currentPrice, market_cap: marketCap } =
    apiMarketData.market_data;

  return {
    ...original,
    duskAPI: {
      ...original.duskAPI,
      getMarketData: () =>
        resolveAfter(marketDataSettleTime, { currentPrice, marketCap }),
      getNodeLocations: vi.fn().mockResolvedValue(nodeLocationsCount),
      getStats: vi.fn().mockResolvedValue(apiStats),
    },
  };
});

/**
 * The titles of the leading cards, or of the smaller ones after them.
 *
 * @param {HTMLElement} container
 * @param {"primary" | "secondary"} which
 */
const titlesOf = (container, which) =>
  Array.from(
    container.querySelectorAll(
      `.statistics-panel__statistics-item--${which} .statistics-panel__statistics-item-title`
    ),
    (title) => title.textContent?.trim()
  );

describe("StatisticsPanel", () => {
  const { statsFetchInterval } = get(appStore);

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/components");
    vi.doUnmock("$lib/services");
  });

  /** @param {number} chainId */
  const setChain = (chainId) =>
    appStore.setNodeInfo({
      ...get(appStore).nodeInfo,
      // eslint-disable-next-line camelcase
      chain_id: chainId,
    });

  it("should render the StatisticsPanel, query for the necessary info, start polling for stats and stop the polling when unmounted", async () => {
    setChain(1);

    const { container, unmount } = render(StatisticsPanel);

    expect(container.firstElementChild).toMatchSnapshot();
    expect(duskAPI.getStats).toHaveBeenCalledTimes(1);
    expect(duskAPI.getStats).toHaveBeenNthCalledWith(1);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    // snapshot with received data from APIs
    expect(container.firstElementChild).toMatchSnapshot();

    await vi.advanceTimersByTimeAsync(
      statsFetchInterval - marketDataSettleTime
    );

    expect(duskAPI.getStats).toHaveBeenCalledTimes(2);
    expect(duskAPI.getStats).toHaveBeenNthCalledWith(2);

    await vi.advanceTimersByTimeAsync(statsFetchInterval);

    expect(duskAPI.getStats).toHaveBeenCalledTimes(3);
    expect(duskAPI.getStats).toHaveBeenNthCalledWith(3);

    unmount();

    await vi.advanceTimersByTimeAsync(statsFetchInterval * 10);

    expect(duskAPI.getStats).toHaveBeenCalledTimes(3);
  });
  it("should show no DUSK price or market cap on a test network", async () => {
    vi.mocked(duskAPI.getStats).mockClear();
    setChain(2);

    const { container, getByText, queryByText } = render(StatisticsPanel);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    expect(queryByText("DUSK price")).toBeNull();
    expect(queryByText("Market cap")).toBeNull();
    expect(getByText("Current stake")).toBeInTheDocument();
    expect(
      container.querySelectorAll(".statistics-panel__statistics-item")
    ).toHaveLength(8);
    // Four numbers lead as cards; the rest follow, smaller.
    expect(titlesOf(container, "primary")).toStrictEqual([
      "Current stake",
      "Last block",
      "Total transactions",
      "Active provisioners",
    ]);
    expect(titlesOf(container, "secondary")).toStrictEqual([
      "Pending stake",
      "Pending provisioners",
      "Largest node cluster",
      "Largest cluster location",
    ]);

    await act(() => setChain(1));

    expect(getByText("DUSK price")).toBeInTheDocument();
    expect(getByText("Market cap")).toBeInTheDocument();
    // On mainnet the price leads, and the market cap follows.
    expect(titlesOf(container, "primary")[0]).toBe("DUSK price");
    expect(titlesOf(container, "secondary")[0]).toBe("Market cap");
  });

  it("should lead with the network's map, and say what its rings are", async () => {
    const { container } = render(StatisticsPanel);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    const face = container.querySelector(".statistics-panel__face");

    expect(face?.tagName).toBe("FIGURE");
    expect(face?.querySelector(".nodes-world-map")).toHaveAttribute(
      "data-places",
      String(mockData.nodeLocationsCount.length)
    );
    expect(face?.querySelector("figcaption")).toHaveTextContent(
      "Rings show where provisioners run nodes. The bigger the ring, the more nodes."
    );
    // First in the panel, before the numbers.
    expect(container.firstElementChild?.firstElementChild).toBe(face);
  });
});
