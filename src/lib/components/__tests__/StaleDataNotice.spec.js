import { afterAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { apiMarketData, apiNodeInfo } from "$lib/mock-data";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

import { StaleDataNotice } from "..";

// The market data the store reads, as the test gives it.
vi.mock("$lib/services", async (importOriginal) => {
  /** @type {import("$lib/services")} */
  const original = await importOriginal();

  return {
    ...original,
    duskAPI: { ...original.duskAPI, getMarketData: vi.fn() },
  };
});

/*
 * A price shown from market data too old to trust comes with a warning.
 */
describe("StaleDataNotice", () => {
  afterAll(() => {
    cleanup();
    vi.useRealTimers();
    vi.doUnmock("$lib/services");
  });

  it("should warn once the market data is stale: not while it is fresh or being read again, and once a read failed", async () => {
    vi.useFakeTimers();

    const {
      circulating_supply: circulatingSupply,
      current_price: currentPrice,
      market_cap: marketCap,
    } = apiMarketData.market_data;
    const next = Promise.withResolvers();

    vi.mocked(duskAPI.getMarketData)
      .mockResolvedValueOnce({ circulatingSupply, currentPrice, marketCap })
      .mockReturnValueOnce(/** @type {any} */ (next.promise));

    const { container } = render(StaleDataNotice);
    const warned = () =>
      container.querySelector("[data-tooltip-type='warning']") !== null;

    // On mainnet, the store reads the market data: fresh.
    await act(() => appStore.setNodeInfo({ ...apiNodeInfo, chain_id: 1 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(duskAPI.getMarketData).toHaveBeenCalledOnce();
    expect(warned()).toBe(false);

    // Read again later, which takes a while: no warning while it's read.
    await vi.advanceTimersByTimeAsync(
      get(appStore).marketDataFetchInterval * 1.5,
    );

    expect(duskAPI.getMarketData).toHaveBeenCalledTimes(2);
    expect(warned()).toBe(false);

    // That read failed: what the page shows is stale.
    await act(() => next.reject(new Error("offline")));
    await vi.advanceTimersByTimeAsync(0);

    expect(warned()).toBe(true);
  });
});
