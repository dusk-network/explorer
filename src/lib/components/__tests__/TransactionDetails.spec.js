import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { apiMarketData, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionDetails } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/*
 * The page works out what an amount and a fee are worth in dollars itself:
 * these check the figures, wherever the page puts them.
 */
describe("Transaction Details", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20));

  const props = {
    data: transformTransaction(gqlTransaction.tx),
    error: null,
    loading: false,
    market: {
      currentPrice: apiMarketData.market_data.current_price,
      marketCap: apiMarketData.market_data.market_cap,
    },
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should give the amount and the fee in DUSK, and their worth in dollars rounded to cents", () => {
    const { container } = render(TransactionDetails, props);

    // 9,812.378912731 DUSK at $0.36835.
    expect(container).toHaveTextContent("9,812.378912731 DUSK");
    expect(container).toHaveTextContent("$3,614.39");
    expect(container).toHaveTextContent("0.000290766 DUSK");
    expect(container).toHaveTextContent("< $0.01");
  });

  it("should give amounts in DUSK alone when there is no price", () => {
    const { container } = render(TransactionDetails, {
      ...props,
      market: null,
    });

    expect(container).toHaveTextContent("9,812.378912731 DUSK");
    expect(container).toHaveTextContent("0.000290766 DUSK");
    expect(container.textContent).not.toContain("$");
  });
});
