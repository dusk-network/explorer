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

  it("should warn once the market data is stale: not while it is fresh or read again, but once it got old or a read failed", async () => {
    vi.useFakeTimers();

    const {
      circulating_supply: circulatingSupply,
      current_price: currentPrice,
      market_cap: marketCap,
    } = apiMarketData.market_data;
    const next = Promise.withResolvers();
    const interval = get(appStore).marketDataFetchInterval;

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

    // A hidden tab reads nothing: the data gets old, with no read failing,
    // and says so as the page draws again.
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);

    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(interval * 1.5);
    await act(() =>
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: 1, version: "next" }),
    );

    expect(duskAPI.getMarketData).toHaveBeenCalledOnce();
    expect(warned()).toBe(true);

    // Shown again, it reads again: no warning while it does.
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect(duskAPI.getMarketData).toHaveBeenCalledTimes(2);
    expect(warned()).toBe(false);

    // That read failed: stale again.
    await act(() => next.reject(new Error("offline")));
    await vi.advanceTimersByTimeAsync(0);

    expect(warned()).toBe(true);

    hidden.mockRestore();
  });
});
