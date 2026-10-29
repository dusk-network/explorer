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

/**
 * The ends a full value beside a term sets apart.
 *
 * @param {HTMLElement} container
 * @param {string} term
 */
const getEnds = (container, term) =>
  Array.from(
    Array.from(container.querySelectorAll("dt"))
      .find((dt) => termOf(dt) === term)
      ?.nextElementSibling?.querySelectorAll(".full-value__end") ?? [],
    (end) => end.textContent
  );

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
      "fee paid",
      "type",
      "visibility",
      "memo",
      "block height",
      "gas used",
      "gas price",
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
      "gas used",
      "gas price",
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
        "alice.dusk sent 9,812.378912731 DUSK to mHWZo9…pjiUnj Completed · Tue 16 Apr 2024, 6:39:09 AM UTC"
      )
    );

    cleanup();
    vi.mocked(getPrimaryName).mockResolvedValue(null);

    const failed = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, txerror: "Panic" },
    });

    expect(
      failed.container.querySelector(".transaction-details__outcome--failed")
    ).toHaveTextContent("Failed");
  });

  it("should keep the sentence's shortened IDs whole, as a line may break after their '…'", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(
      Array.from(
        container.querySelectorAll(
          ".transaction-details__summary-text .detail-summary__id"
        ),
        (id) => id.textContent
      )
    ).toStrictEqual(["kT5Bam…LwKbXj", "mHWZo9…pjiUnj"]);
  });

  it("should give the status in its colour: green when it went through, red when it failed", () => {
    const { container } = render(TransactionDetails, baseProps);
    const outcome = container.querySelector(".transaction-details__outcome");

    expect(outcome).toHaveTextContent(/^Completed$/);
    expect(outcome).toHaveClass("transaction-details__outcome--completed");
    expect(outcome).not.toHaveClass("transaction-details__outcome--failed");

    cleanup();

    const failed = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, txerror: "Panic" },
    }).container.querySelector(".transaction-details__outcome");

    expect(failed).toHaveTextContent(/^Failed$/);
    expect(failed).toHaveClass("transaction-details__outcome--failed");
    expect(failed).not.toHaveClass("transaction-details__outcome--completed");
  });

  it("should give the status and the time in the viewer's zone once, under the sentence", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(
      container.querySelector(".transaction-details__summary-meta")
    ).toHaveTextContent(/^Completed · Tue 16 Apr 2024, 6:39:09 AM UTC$/);
    expect(getTerms(container)).not.toContain("status");
    expect(getTerms(container)).not.toContain("timestamp");
  });

  it("should give the status, its dot and the time as the parts of one line, the time in a part of its own", () => {
    const { container } = render(TransactionDetails, baseProps);
    const meta = /** @type {HTMLElement} */ (
      container.querySelector(".transaction-details__summary-meta")
    );

    // The line's parts keep together; only the time may wrap, inside itself.
    expect(
      Array.from(meta.children, (part) => part.textContent?.trim())
    ).toStrictEqual(["Completed", "·", "Tue 16 Apr 2024, 6:39:09 AM UTC"]);
    expect(meta.lastElementChild).toHaveClass("transaction-details__time");
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
      container.querySelector(".transaction-details__outcome--failed")
    ).toHaveAttribute("data-tooltip-text", "Panic");
    expect(getDefinition(container, "error")).toBe("Panic");
  });

  it("should name the DuskEVM bridge on testnet, and say which DuskEVM address a deposit pays", async () => {
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";

    appStore.setNodeInfo(apiNodeInfo);

    const { container, getByRole } = render(TransactionDetails, {
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
        "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01↗ on DuskEVM"
      );
      expect(getDefinition(container, "contract")).toBe(
        `DuskEVM bridge ${bridge}`
      );
      expect(getDefinition(container, "type")).toBe("Deposit to DuskEVM");
      expect(getDefinition(container, "method")).toBe("depositETHToWithValue");
      expect(getDefinition(container, "visibility")).toBe(
        "Public Sender, receiver and amount are visible to everyone"
      );
      expect(
        container.querySelector(".transaction-details__summary-text")
      ).toHaveTextContent(
        /^kT5Bam…LwKbXj sent 0\.5 DUSK to 0x5A3d…8a01 on DuskEVM$/
      );
    });

    // The address opens on the testnet's DuskEVM explorer, its arrow
    // left unread.
    const address = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";

    expect(
      getByRole("link", { name: `${address} on the DuskEVM explorer` })
    ).toHaveAttribute(
      "href",
      `https://explorer.testnet.evm.dusk.network/address/${address}`
    );
    expect(
      container.querySelector(".transaction-details__evm-site")
    ).toHaveAttribute("aria-hidden", "true");
    // Its ends set apart as every Dusk app shortens it: 0x and four, and four.
    expect(getEnds(container, "to")).toStrictEqual(["0x5A3d", "8a01"]);

    // eslint-disable-next-line camelcase
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  it("should explain only the terms that need it, with help reachable from the keyboard and named after its term", () => {
    const { getAllByRole } = render(TransactionDetails, baseProps);
    const helps = getAllByRole("button", { name: /^About / });

    expect(helps.map((help) => help.getAttribute("aria-label"))).toStrictEqual([
      "About gas used",
      "About gas price",
      "About nonce",
    ]);
    expect(
      helps.map((help) => help.getAttribute("data-tooltip-text"))
    ).toStrictEqual([
      "The gas the transaction used, of the most it could use. Only the gas used is paid for",
      "The transaction gas price, in LUX (1 DUSK = 1,000,000,000 LUX)",
      "The number of transactions sent from this address",
    ]);
    expect(helps[1].tagName).toBe("BUTTON");
    expect(helps[1]).toHaveAccessibleDescription(
      "The transaction gas price, in LUX (1 DUSK = 1,000,000,000 LUX)"
    );
  });

  it("should show amounts in DUSK, with dollars rounded to cents", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getDefinition(container, "amount")).toBe(
      "9,812.378912731 DUSK ($3,614.39)"
    );
    expect(getDefinition(container, "fee paid")).toBe(
      "0.000290766 DUSK (< $0.01)"
    );
  });

  it("should show amounts in DUSK when there is no price", () => {
    const { container } = render(TransactionDetails, {
      ...baseProps,
      market: null,
    });

    expect(getDefinition(container, "amount")).toBe("9,812.378912731 DUSK");
    expect(getDefinition(container, "fee paid")).toBe("0.000290766 DUSK");
  });

  it("should give gas as the Dusk wallets do: the gas used of the limit, and the price in LUX", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getDefinition(container, "gas used")).toBe("290,766 of 500,000,000");
    expect(getDefinition(container, "gas price")).toBe("1 LUX");
  });

  it("should give its own ID in full to copy, as it opens nothing, and the addresses as links", () => {
    const { container, getByRole, queryByRole } = render(
      TransactionDetails,
      baseProps
    );

    expect(getDefinition(container, "id")).toBe(transaction.txid);
    expect(queryByRole("link", { name: transaction.txid })).toBeNull();
    expect(
      getByRole("link", { name: /** @type {string} */ (transaction.from) })
    ).toHaveAttribute("href", `${base}/accounts/?key=${transaction.from}`);
    expect(
      getByRole("link", { name: /** @type {string} */ (transaction.to) })
    ).toHaveAttribute("href", `${base}/accounts/?key=${transaction.to}`);
  });

  it("should give the ID and the addresses in full, their ends set apart, each with a Copy", () => {
    const { container, getByRole } = render(TransactionDetails, baseProps);
    const id = /** @type {Element} */ (
      Array.from(container.querySelectorAll("dt")).find(
        (dt) => termOf(dt) === "id"
      )?.nextElementSibling
    );

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
      // Plain words for the type; the method is a technical detail.
      expect(getDefinition(container, "type")).toBe("Claim rewards");
    });
    expect(getTerms(container)).not.toContain("to");
    expect(
      container.querySelector(".transaction-details__technical dl dt")
    ).toHaveTextContent("Method");
    expect(getDefinition(container, "method")).toBe("withdraw");
  });

  it("should give no method for a transaction that calls no contract", () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getTerms(container)).not.toContain("method");
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
    expect(getDefinition(container, "visibility")).toBe(
      "Shielded Sender, receiver and amount are hidden"
    );
  });

  it("should say in a row of its own that a transaction is public, and what that shows", async () => {
    const { container } = render(TransactionDetails, baseProps);

    expect(getDefinition(container, "visibility")).toBe(
      "Public Sender, receiver and amount are visible to everyone"
    );
    // Not as a tag beside the type any more.
    await vi.waitFor(() =>
      expect(getDefinition(container, "type")).toBe("Transfer")
    );
    expect(container.querySelector(".transaction-type__privacy")).toBeNull();
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

  it("should name an account its network's labels name, before any primary name", async () => {
    const bscBridge =
      "24jFms4JqYdWb19jFn3CUjNUQz1AeRozYnwsHuUkLbXAj2gRBq598aLAJmqmsaPcsCNJTgTaJTaUZCXpT3s9UeWBsHTmd5hQx95JymZSUsmtwoibiB8AMp4bZjAiLMjmAH3x";

    vi.mocked(getPrimaryName).mockResolvedValue({
      name: "bob.dusk",
      url: "https://dusk.domains/name/bob.dusk",
    });
    // On mainnet, whose file labels the BSC bridge's account.
    // eslint-disable-next-line camelcase
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: 1 });

    const { container } = render(TransactionDetails, {
      ...baseProps,
      data: { ...baseProps.data, to: bscBridge },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-details__summary-text")
      ).toHaveTextContent(
        /^bob\.dusk sent 9,812\.378912731 DUSK to BSC bridge$/
      )
    );
    expect(getDefinition(container, "to")).toBe(`BSC bridge ${bscBridge}`);

    vi.mocked(getPrimaryName).mockResolvedValue(null);
    // eslint-disable-next-line camelcase
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
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
    expect(getDefinition(container, "fee paid")).toBe(
      "0.000290766 DUSK (< $0.01)"
    );
  });
});
