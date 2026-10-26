import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { base } from "$app/paths";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { apiMarketData, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { getPrimaryName } from "$lib/dusk-domains";

import { TransactionDetails } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/** @param {string} text */
const toHex = (text) => Buffer.from(text, "utf8").toString("hex");

/**
 * The terms of the details list, in order.
 *
 * @param {HTMLElement} container
 */
const getTerms = (container) =>
  Array.from(container.querySelectorAll("dt"), (dt) =>
    dt.textContent?.trim().toLowerCase()
  );

/**
 * The definition beside a term.
 *
 * @param {HTMLElement} container
 * @param {string} term
 */
const getDefinition = (container, term) =>
  Array.from(container.querySelectorAll("dt"))
    .find((dt) => dt.textContent?.trim().toLowerCase() === term)
    ?.nextElementSibling?.textContent?.replace(/\s+/g, " ")
    .trim();

describe("Transaction Details", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20));

  const transaction = transformTransaction(gqlTransaction.tx);

  // The node gives memos in hex.
  const memo = "some notes about the transaction";
  const baseProps = {
    data: { ...transaction, memo: toHex(memo) },
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

  it("renders the Transaction Details component", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show the loading state before there is data", () => {
    const { getByRole } = render(TransactionDetails, {
      ...baseProps,
      data: /** @type {any} */ (null),
      loading: true,
    });

    expect(getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders the Transaction Details component with the payload visible", async () => {
    const { container, getByRole } = render(TransactionDetails, baseProps);

    await fireEvent.click(getByRole("switch", { name: "Show payload" }));

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should lead with the status, the parties and the amount, and end with the technical details", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getTerms(container)).toStrictEqual([
      "id",
      "status",
      "from",
      "to",
      "amount",
      "transaction fee",
      "timestamp",
      "type",
      "memo",
      "block height",
      "gas price",
      "transaction gas limit",
      "gas spent",
      "nonce",
      "payload",
    ]);
  });

  it("should show amounts in DUSK, with dollars rounded to cents", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getDefinition(container, "amount")).toBe(
      "9,812.378912731 DUSK ($3,614.39)"
    );
    expect(getDefinition(container, "transaction fee")).toBe(
      "0.000290766 DUSK (< $0.01)"
    );
  });

  it("should show amounts in DUSK when there is no price", () => {
    const { container } = render(TransactionDetails, {
      ...baseProps,
      market: null,
    });

    expect(getDefinition(container, "amount")).toBe("9,812.378912731 DUSK");
    expect(getDefinition(container, "transaction fee")).toBe(
      "0.000290766 DUSK"
    );
  });

  it("should give gas in one format, the price in LUX", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getDefinition(container, "gas price")).toBe("1 LUX");
    expect(getDefinition(container, "transaction gas limit")).toBe(
      "500,000,000"
    );
    expect(getDefinition(container, "gas spent")).toBe("290,766");
  });

  it("should show the full ID and addresses on wide screens", () => {
    const { getByRole } = render(TransactionDetails, baseProps);

    expect(getByRole("link", { name: transaction.txid })).toBeInTheDocument();
    expect(
      getByRole("link", { name: /** @type {string} */ (transaction.from) })
    ).toBeInTheDocument();
  });

  it("should show the memo as text, with hex as an option", async () => {
    const { container, getByRole } = render(TransactionDetails, baseProps);

    expect(getDefinition(container, "memo")).toBe(`${memo} Hex`);

    await fireEvent.click(getByRole("switch", { name: "Show memo as hex" }));

    expect(getDefinition(container, "memo")).toBe(`${toHex(memo)} Hex`);
  });

  it("should show a memo that isn't text as hex, without a switch", () => {
    const { container, queryByRole } = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, memo: "ff00ff" },
    });

    expect(getDefinition(container, "memo")).toBe("ff00ff");
    expect(queryByRole("switch", { name: "Show memo as hex" })).toBeNull();
  });

  it("should name the memo and payload switches", () => {
    const { getByRole } = render(TransactionDetails, baseProps);

    expect(
      getByRole("switch", { name: "Show memo as hex" })
    ).toBeInTheDocument();
    expect(getByRole("switch", { name: "Show payload" })).toBeInTheDocument();
  });

  it("should name the contract a call went to and what the call did", async () => {
    const stake =
      "0200000000000000000000000000000000000000000000000000000000000000";
    const { container } = render(TransactionDetails, {
      ...baseProps,
      data: {
        ...baseProps.data,
        amount: 0,
        contract: stake,
        deposit: 0,
        method: "withdraw",
        to: null,
      },
    });

    await vi.waitFor(() => {
      expect(getDefinition(container, "contract")).toBe(
        `Stake contract ${stake}`
      );
      expect(getDefinition(container, "type")).toBe(
        "Public withdraw Claim rewards"
      );
    });
    expect(getTerms(container)).not.toContain("to");
  });

  it("should show the DUSK a call sends to its contract as the amount", () => {
    const { container } = render(TransactionDetails, {
      ...baseProps,
      data: {
        ...baseProps.data,
        amount: 0,
        contract:
          "0200000000000000000000000000000000000000000000000000000000000000",
        deposit: 1_000_000_000_000,
        method: "stake",
        to: null,
      },
      market: null,
    });

    expect(getDefinition(container, "amount")).toBe("1,000.00 DUSK");
  });

  it("should say what a shielded transaction hides", () => {
    const { container } = render(TransactionDetails, {
      ...baseProps,
      data: {
        ...baseProps.data,
        amount: undefined,
        from: undefined,
        to: undefined,
        txtype: "Phoenix",
      },
    });

    expect(getDefinition(container, "from")).toBe("Shielded");
    expect(getDefinition(container, "to")).toBe("Shielded");
    expect(getDefinition(container, "amount")).toBe("Shielded");
  });

  it("should show the sender's and receiver's primary names", async () => {
    vi.mocked(getPrimaryName).mockImplementation(async (address) => {
      const name = address === baseProps.data.from ? "alice.dusk" : "bob.dusk";

      return { name, url: `https://dusk.domains/name/${name}` };
    });

    const { getByRole } = render(TransactionDetails, baseProps);

    await vi.waitFor(() => {
      expect(getByRole("link", { name: "alice.dusk" })).toHaveAttribute(
        "href",
        `${base}/accounts/?key=${baseProps.data.from}`
      );
      expect(getByRole("link", { name: "bob.dusk" })).toHaveAttribute(
        "href",
        `${base}/accounts/?key=${baseProps.data.to}`
      );
    });
    expect(
      getByRole("link", { name: "Open alice.dusk on Dusk Domains" })
    ).toHaveAttribute("href", "https://dusk.domains/name/alice.dusk");

    vi.mocked(getPrimaryName).mockResolvedValue(null);
  });

  it("should be able to render the details when they contain blob hashes", () => {
    const props = {
      ...baseProps,
      data: {
        ...baseProps.data,
        blobHashes: [
          "0261047715f0e937f3ab3d6bdfb1bf1894995f89f64ed19a26a1d59bb2d7b629",
          "b3d5296139ba0f44912b87a19b47ea7f229131182405d9f082c5fbbeed8c121b",
          "8f6bce4e1f233d6de022e3ac1ab3a262695991460e9f78eca288fd623083142f",
        ],
      },
    };

    const { container } = render(TransactionDetails, props);

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
