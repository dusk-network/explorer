import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { resolveAfter } from "$lib/dusk/promise";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

import { StatisticsPanel } from "..";

const marketDataSettleTime = vi.hoisted(() => {
  vi.useFakeTimers();

  return 100;
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

describe("StatisticsPanel", () => {
  const { statsFetchInterval } = get(appStore);

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
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

    expect(queryByText("Dusk Price")).toBeNull();
    expect(queryByText("Total Market Cap")).toBeNull();
    expect(getByText("Current Stake")).toBeInTheDocument();
    expect(
      container.querySelectorAll(".statistics-panel__statistics-item")
    ).toHaveLength(8);

    await act(() => setChain(1));

    expect(getByText("Dusk Price")).toBeInTheDocument();
    expect(getByText("Total Market Cap")).toBeInTheDocument();
  });
});
