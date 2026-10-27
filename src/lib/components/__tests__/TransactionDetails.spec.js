import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { base } from "$app/paths";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { apiMarketData, apiNodeInfo, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { getPrimaryName } from "$lib/dusk-domains";
import { appStore } from "$lib/stores";

import { TransactionDetails } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/** @param {string} text */
const toHex = (text) => Buffer.from(text, "utf8").toString("hex");

/**
 * A term as it reads, without its help.
 *
 * @param {Element} dt
 */
const termOf = (dt) => {
  const term = /** @type {Element} */ (dt.cloneNode(true));

  term.querySelector(".detail-list__help")?.remove();

  return term.textContent?.trim().toLowerCase();
};

/**
 * The terms of the details list, in order.
 *
 * @param {HTMLElement} container
 */
const getTerms = (container) =>
  Array.from(container.querySelectorAll("dt"), termOf);

/**
 * The definition beside a term, without the word on its Copy button.
 *
 * @param {HTMLElement} container
 * @param {string} term
 */
const getDefinition = (container, term) => {
  const definition = Array.from(container.querySelectorAll("dt")).find(
    (dt) => termOf(dt) === term
  )?.nextElementSibling;
  const value = /** @type {Element | undefined} */ (
    definition?.cloneNode(true)
  );

  value?.querySelectorAll(".dusk-copy-button").forEach((copy) => copy.remove());

  return value?.textContent?.replace(/\s+/g, " ").trim();
};

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

    // The status and the time are in the line under the sentence.
    expect(getTerms(container)).toStrictEqual([
      "id",
      "from",
      "to",
      "amount",
      "transaction fee",
      "type",
      "memo",
      "block height",
      "gas price",
      "transaction gas limit",
      "gas spent",
      "nonce",
      "payload",
    ]);

    // Gas, the nonce and the payload are folded under "Technical details".
    const technical = /** @type {HTMLDetailsElement} */ (
      container.querySelector("details")
    );

    expect(technical.open).toBe(false);
    expect(technical.querySelector("summary")).toHaveTextContent(
      "Technical details"
    );
    expect(Array.from(technical.querySelectorAll("dt"), termOf)).toStrictEqual([
      "gas price",
      "transaction gas limit",
      "gas spent",
      "nonce",
      "payload",
    ]);
  });

  it("should lead with one sentence: who sent how much to whom, the status, and the time in the viewer's zone", async () => {
    vi.mocked(getPrimaryName).mockImplementation(async (address) =>
      address === baseProps.data.from
        ? { name: "alice.dusk", url: "https://dusk.domains/name/alice.dusk" }
        : null
    );

    const { container } = render(TransactionDetails, baseProps);
    const summary = () =>
      container
        .querySelector(".transaction-details__summary")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();

    await vi.waitFor(() =>
      expect(summary()).toBe(
        "alice.dusk sent 9,812.378912731 DUSK to mHWZo9...pjiUnj Completed · Tue 16 Apr 2024, 06:39:09 UTC"
      )
    );

    cleanup();
    vi.mocked(getPrimaryName).mockResolvedValue(null);

    const failed = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, txerror: "Panic" },
    });

    expect(
      failed.container.querySelector(".transaction-details__summary-failed")
    ).toHaveTextContent("Failed");
  });

  it("should give the status and the time in the viewer's zone once, under the sentence", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(
      container.querySelector(".transaction-details__summary-meta")
    ).toHaveTextContent(/^Completed · Tue 16 Apr 2024, 06:39:09 UTC$/);
    expect(getTerms(container)).not.toContain("status");
    expect(getTerms(container)).not.toContain("timestamp");
  });

  it("should leave out a memo or a payload that isn't there", () => {
    const { container, queryByRole } = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, memo: "", payload: "" },
    });

    expect(getTerms(container)).not.toContain("memo");
    expect(getTerms(container)).not.toContain("payload");
    expect(queryByRole("switch", { name: "Show payload" })).toBeNull();
  });

  it('should give a failure\'s error on hover of "Failed", and in the technical details', () => {
    const { container } = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, txerror: "Panic" },
    });

    expect(
      container.querySelector(".transaction-details__summary-failed")
    ).toHaveAttribute("data-tooltip-text", "Panic");
    expect(getDefinition(container, "error")).toBe("Panic");
  });

  it("should name the DuskEVM bridge on testnet, and say which DuskEVM address a deposit pays", async () => {
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";

    appStore.setNodeInfo(apiNodeInfo);

    const { container } = render(TransactionDetails, {
      ...baseProps,
      data: {
        ...baseProps.data,
        amount: 0,
        contract: bridge,
        deposit: 500_000_000,
        method: "depositETHToWithValue",
        payload: /** @type {any} */ ({
          call: {
            contract: bridge,
            // eslint-disable-next-line camelcase
            fn_args: "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==",
            // eslint-disable-next-line camelcase
            fn_name: "depositETHToWithValue",
          },
        }),
        to: null,
      },
      market: null,
    });

    await vi.waitFor(() => {
      expect(getDefinition(container, "to")).toBe(
        "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01 on DuskEVM"
      );
      expect(getDefinition(container, "contract")).toBe(
        `DuskEVM bridge ${bridge}`
      );
      expect(getDefinition(container, "type")).toBe(
        "Public Deposit to DuskEVM · depositETHToWithValue"
      );
      expect(
        container.querySelector(".transaction-details__summary-text")
      ).toHaveTextContent(
        /^kT5Bam\.\.\.LwKbXj sent 0\.5 DUSK to 0x5A3d\.\.\.8a01 on DuskEVM$/
      );
    });

    // eslint-disable-next-line camelcase
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  it("should explain only the terms that need it, with help reachable from the keyboard", () => {
    const { getAllByRole } = render(TransactionDetails, baseProps);
    const helps = getAllByRole("button", { name: "More information" });

    expect(
      helps.map((help) => help.getAttribute("data-tooltip-text"))
    ).toStrictEqual([
      "The transaction gas price, in LUX (1 DUSK = 1,000,000,000 LUX)",
      "The most gas the transaction could use. Only the gas spent is paid for",
      "The number of transactions sent from this address",
    ]);
    expect(helps[0].tagName).toBe("BUTTON");
    expect(helps[0]).toHaveAccessibleDescription(
      "The transaction gas price, in LUX (1 DUSK = 1,000,000,000 LUX)"
    );
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

  it("should give the ID and the addresses in full, their ends set apart, each with a Copy", () => {
    const { getByRole } = render(TransactionDetails, baseProps);
    const id = getByRole("link", { name: transaction.txid });

    expect(
      Array.from(id.querySelectorAll(".full-value__end"), (end) =>
        end.textContent?.trim()
      )
    ).toStrictEqual([transaction.txid.slice(0, 6), transaction.txid.slice(-6)]);
    expect(
      getByRole("button", { name: "Copy transaction ID" })
    ).toHaveTextContent(/^Copy$/);
    expect(
      getByRole("button", { name: "Copy sender's address" })
    ).toHaveTextContent(/^Copy$/);
    expect(
      getByRole("button", { name: "Copy receiver's address" })
    ).toHaveTextContent(/^Copy$/);
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
        "Public Claim rewards · withdraw"
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

    expect(getDefinition(container, "amount")).toBe("1,000 DUSK");
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

  it("should add the dollars once the price comes, on a page opened before it", async () => {
    const { container, rerender } = render(TransactionDetails, {
      ...baseProps,
      market: null,
    });

    expect(getDefinition(container, "amount")).toBe("9,812.378912731 DUSK");

    await rerender({ market: baseProps.market });

    expect(getDefinition(container, "amount")).toBe(
      "9,812.378912731 DUSK ($3,614.39)"
    );
    expect(getDefinition(container, "transaction fee")).toBe(
      "0.000290766 DUSK (< $0.01)"
    );
  });
});
