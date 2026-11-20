import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";

import { marketDataStore } from "$lib/stores";

import { StaleDataNotice } from "..";

const { market } = vi.hoisted(() => ({
  /** @type {{ set: (value: any) => void }} */
  market: { set: () => {} },
}));

// The market data, and whether it is stale, as the test gives them.
vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {import("$lib/stores")} */
  const original = await importOriginal();
  const { writable } = await import("svelte/store");
  const store = writable({
    data: null,
    error: null,
    isLoading: false,
    lastUpdate: null,
  });

  market.set = store.set;

  return {
    ...original,
    marketDataStore: { ...store, isDataStale: vi.fn(() => false) },
  };
});

/*
 * A price shown from data too old to trust comes with a warning.
 */
describe("StaleDataNotice", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(marketDataStore.isDataStale).mockReturnValue(false);
  });

  afterAll(() => {
    vi.doUnmock("$lib/stores");
  });

  /** @param {HTMLElement} container */
  const warningOf = (container) =>
    container.querySelector("[data-tooltip-type='warning']");

  it("should warn while the market data is stale, and only then", async () => {
    const data = { data: { currentPrice: { usd: 0.36835 } }, error: null };
    const { container } = render(StaleDataNotice);

    // Nothing read yet: nothing to warn about.
    expect(warningOf(container)).toBeNull();

    await act(() =>
      market.set({ ...data, isLoading: false, lastUpdate: new Date() }),
    );

    expect(warningOf(container)).toBeNull();

    vi.mocked(marketDataStore.isDataStale).mockReturnValue(true);
    await act(() =>
      market.set({ ...data, isLoading: true, lastUpdate: new Date(0) }),
    );

    expect(warningOf(container)).not.toBeNull();
  });
});
