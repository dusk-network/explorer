import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { base } from "$app/paths";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { apiMarketData, apiNodeInfo, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { getPrimaryName } from "$lib/dusk-domains";
import { appStore } from "$lib/stores";

import { TransactionDetails } from "..";

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/**
 * A row's value, found by the name of its field: the labels' words are
 * copy, what each field holds isn't.
 *
 * @param {HTMLElement} container
 * @param {RegExp} field
 * @returns {HTMLElement}
 */
const rowOf = (container, field) => {
  const term = Array.from(container.querySelectorAll("dt")).find((dt) => {
    const label = /** @type {Element} */ (dt.cloneNode(true));

    label.querySelector(".detail-list__help")?.remove();

    return field.test(label.textContent?.trim() ?? "");
  });

  return /** @type {HTMLElement} */ (term?.nextElementSibling);
};

/**
 * What a row's value reads, without the word on its Copy button.
 *
 * @param {HTMLElement} container
 * @param {RegExp} field
 */
const valueOf = (container, field) => {
  const value = /** @type {Element | undefined} */ (
    rowOf(container, field)?.cloneNode(true)
  );

  value?.querySelectorAll(".dusk-copy-button").forEach((copy) => copy.remove());

  return value?.textContent?.replace(/\s+/g, " ").trim();
};

/**
 * The sentence the page leads with.
 *
 * @param {HTMLElement} container
 */
const leadOf = (container) =>
  container
    .querySelector(".transaction-details__summary-text")
    ?.textContent?.replace(/\s+/g, " ")
    .trim();

/**
 * The status the page gives, in its own word.
 *
 * @param {HTMLElement} container
 */
const statusOf = (container) =>
  container.querySelector(".transaction-details__outcome")?.textContent?.trim();

/**
 * What an explanation of a transaction's privacy says is hidden, and what
 * it says is public: the sentences that say each.
 *
 * @param {string | undefined} text
 */
const saidOf = (text = "") => {
  const sentences = text.split(/\.\s*/);

  return {
    hidden: sentences.filter((s) => /\bhidden\b/i.test(s)).join(". "),
    public: sentences.filter((s) => /\b(public|visible)\b/i.test(s)).join(". "),
  };
};

/** @param {HTMLElement} container */
const explanationOf = (container) =>
  container
    .querySelector(".transaction-details__visibility-seen")
    ?.textContent?.trim();

describe("Transaction Details", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20));

  const transaction = transformTransaction(gqlTransaction.tx);
  const sender = String(transaction.from);
  const receiver = String(transaction.to);
  const props = {
    data: transaction,
    error: null,
    loading: false,
    market: {
      currentPrice: apiMarketData.market_data.current_price,
      marketCap: apiMarketData.market_data.market_cap,
    },
  };
  const stake =
    "0200000000000000000000000000000000000000000000000000000000000000";
  const bridge =
    "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";

  // A 0.5 DUSK deposit to DuskEVM on testnet, which pays 0x5A3d…8a01.
  const recipient = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";
  const deposit = {
    ...transaction,
    amount: 0,
    contract: bridge,
    deposit: 500_000_000,
    method: "depositETHToWithValue",
    payload: /** @type {any} */ ({
      call: {
        contract: bridge,
        fn_args: "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==",
        fn_name: "depositETHToWithValue",
      },
    }),
    to: null,
  };

  /** @type {import("vitest").MockInstance<typeof fetch>} */
  let fetchSpy;

  beforeEach(() => {
    // DuskEVM's explorer is out of reach, unless a test answers for it.
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
  });

  afterEach(() => {
    cleanup();
    fetchSpy.mockRestore();
    vi.mocked(getPrimaryName).mockResolvedValue(null);
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should give the amount and the fee in DUSK, each with its worth in dollars rounded to cents", () => {
    const { container } = render(TransactionDetails, props);

    // 9,812.378912731 DUSK at $0.36835.
    expect(valueOf(container, /^amount$/i)).toBe(
      "9,812.378912731 DUSK ($3,614.39)",
    );
    expect(valueOf(container, /^fee/i)).toBe("0.000290766 DUSK (< $0.01)");
  });

  it("should give amounts in DUSK alone while there is no price, and add the dollars once it comes", async () => {
    const { container, rerender } = render(TransactionDetails, {
      ...props,
      market: null,
    });

    expect(valueOf(container, /^amount$/i)).toBe("9,812.378912731 DUSK");
    expect(valueOf(container, /^fee/i)).toBe("0.000290766 DUSK");

    await rerender({ market: props.market });

    expect(valueOf(container, /^amount$/i)).toBe(
      "9,812.378912731 DUSK ($3,614.39)",
    );
    expect(valueOf(container, /^fee/i)).toBe("0.000290766 DUSK (< $0.01)");
  });

  it("should give the gas used, then its limit, and the gas price in LUX", () => {
    const { container } = render(TransactionDetails, props);

    expect(valueOf(container, /^gas used$/i)).toMatch(
      /^290,766[^\d−-]+500,000,000$/,
    );
    expect(valueOf(container, /^gas price$/i)).toBe("1 LUX");
  });

  it("should mark a failed transaction failed, strike through what it would have sent, and never say it sent it", async () => {
    const style = document.createElement("style");

    style.textContent = readCss(
      "../transaction-details/TransactionDetails.css",
    );
    document.head.append(style);

    /**
     * The part of the amount struck through, as moving nothing.
     *
     * @param {HTMLElement} container
     */
    const struckIn = (container) =>
      Array.from(rowOf(container, /^amount$/i).querySelectorAll("*")).find(
        (part) =>
          getComputedStyle(part).textDecoration.includes("line-through"),
      );

    const completed = render(TransactionDetails, {
      ...props,
      market: null,
    }).container;

    expect(statusOf(completed)).toBe("Completed");
    expect(struckIn(completed)).toBeUndefined();
    await vi.waitFor(() =>
      expect(leadOf(completed)).toBe(
        "kT5Bam…LwKbXj sent 9,812.378912731 DUSK to mHWZo9…pjiUnj",
      ),
    );
    cleanup();

    /** @type {[any, string, RegExp][]} */
    const failures = [
      [
        { ...transaction, txerror: "Panic" },
        "9,812.378912731 DUSK",
        /^kT5Bam…LwKbXj .* 9,812\.378912731 DUSK .* mHWZo9…pjiUnj$/,
      ],
      // A call's deposit doesn't reach its contract either.
      [
        {
          ...transaction,
          amount: 0,
          contract: stake,
          deposit: 20_000_000_000,
          method: "stake",
          to: null,
          txerror: "Panic",
        },
        "20 DUSK",
        /^kT5Bam…LwKbXj .* 20 DUSK$/,
      ],
    ];

    for (const [data, unsent, lead] of failures) {
      const { container } = render(TransactionDetails, {
        ...props,
        data,
        market: null,
      });

      expect(statusOf(container)).toBe("Failed");
      expect(struckIn(container)?.textContent).toBe(unsent);
      await vi.waitFor(() => expect(leadOf(container)).toMatch(lead));
      // Only tried: never sent, paid or staked.
      expect(leadOf(container)).toMatch(/\btried\b/);
      expect(leadOf(container)).not.toMatch(/\b(sent|paid|staked)\b/i);
      cleanup();
    }

    style.remove();
  });

  it("should give its own ID in full, and Copy the whole of it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    const { container } = render(TransactionDetails, props);

    expect(valueOf(container, /^id$/i)).toBe(transaction.txid);

    await fireEvent.click(
      /** @type {Element} */ (
        rowOf(container, /^id$/i).querySelector("button")
      ),
    );

    expect(writeText).toHaveBeenCalledExactlyOnceWith(transaction.txid);
  });

  it("should link the sender and the receiver to their own accounts, given in full and in their case, and Copy each whole", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    const { container } = render(TransactionDetails, props);

    for (const [field, account] of /** @type {[RegExp, string][]} */ ([
      [/^from$/i, sender],
      [/^to$/i, receiver],
    ])) {
      const row = rowOf(container, field);
      const link = row.querySelector(".transaction-details__list-anchor");

      expect(link).toHaveAttribute("href", `${base}/accounts/?key=${account}`);
      expect(link?.textContent?.replace(/\s+/g, "")).toBe(account);

      writeText.mockClear();
      await fireEvent.click(
        /** @type {Element} */ (row.querySelector("button")),
      );

      expect(writeText).toHaveBeenCalledExactlyOnceWith(account);
    }
  });

  it("should give the sender's and the receiver's primary names, each linked to its own account", async () => {
    vi.mocked(getPrimaryName).mockImplementation(async (address) => {
      const name = address === sender ? "alice.dusk" : "bob.dusk";

      return { name, url: `https://dusk.domains/name/${name}` };
    });

    const { container } = render(TransactionDetails, props);

    await vi.waitFor(() => {
      for (const [
        field,
        name,
        account,
      ] of /** @type {[RegExp, string, string][]} */ ([
        [/^from$/i, "alice.dusk", sender],
        [/^to$/i, "bob.dusk", receiver],
      ])) {
        const row = rowOf(container, field);
        const shown = row.querySelector(".primary-name");

        expect(shown?.textContent?.trim()).toBe(name);
        expect(shown).toHaveAttribute(
          "href",
          `${base}/accounts/?key=${account}`,
        );
        // And its page on Dusk Domains.
        expect(row.querySelector(".primary-name__site")).toHaveAttribute(
          "href",
          `https://dusk.domains/name/${name}`,
        );
      }
    });
  });

  it("should show a shielded transfer's sender, receiver and amount as shielded", () => {
    const { container } = render(TransactionDetails, {
      ...props,
      data: {
        ...transaction,
        amount: undefined,
        from: undefined,
        to: undefined,
        txtype: "Phoenix",
      },
    });

    for (const field of [/^from$/i, /^to$/i, /^amount$/i]) {
      expect(valueOf(container, field)).toBe("Shielded");
    }
    expect(
      container.querySelector(".transaction-details__visibility-label"),
    ).toHaveTextContent(/^Shielded$/);

    // Its sender, receiver and amount said hidden, nothing said public.
    const said = saidOf(explanationOf(container));

    expect(said.hidden).toMatch(/sender/i);
    expect(said.hidden).toMatch(/receiver/i);
    expect(said.hidden).toMatch(/amount/i);
    expect(said.public).toBe("");
  });

  it("should never hide what is public: a public transfer, or the DUSK a shielded call sends to its contract", () => {
    const publicTransfer = render(TransactionDetails, {
      ...props,
      market: null,
    }).container;

    expect(
      publicTransfer.querySelector(".transaction-details__visibility-label"),
    ).toHaveTextContent(/^Public$/);
    expect(saidOf(explanationOf(publicTransfer))).toStrictEqual({
      hidden: "",
      public: expect.stringMatching(/sender.*receiver.*amount/i),
    });
    for (const field of [/^from$/i, /^to$/i, /^amount$/i]) {
      expect(valueOf(publicTransfer, field)).not.toBe("Shielded");
    }
    cleanup();

    // A shielded stake: who sent it is hidden, the DUSK it stakes isn't.
    const { container } = render(TransactionDetails, {
      ...props,
      data: {
        ...transaction,
        amount: undefined,
        contract: stake,
        deposit: 1_000_000_000_000,
        from: undefined,
        method: "stake",
        to: undefined,
        txtype: "Phoenix",
      },
      market: null,
    });

    expect(valueOf(container, /^from$/i)).toBe("Shielded");
    expect(valueOf(container, /^amount$/i)).toBe("1,000 DUSK");

    // The contract and the DUSK sent to it are said public, never hidden.
    const said = saidOf(explanationOf(container));

    expect(said.hidden).not.toMatch(/contract|DUSK/i);
    expect(said.public).toMatch(/contract/i);
    expect(said.public).toMatch(/DUSK/);
  });

  it("should give the DuskEVM address a deposit pays, on DuskEVM, linked on DuskEVM's explorer", async () => {
    appStore.setNodeInfo(apiNodeInfo);

    const { container } = render(TransactionDetails, {
      ...props,
      data: deposit,
      market: null,
    });

    await vi.waitFor(() =>
      expect(valueOf(container, /^to$/i)).toMatch(
        new RegExp(`^${recipient}\\W* on DuskEVM$`),
      ),
    );
    expect(
      rowOf(container, /^to$/i).querySelector(
        ".transaction-details__evm-address",
      ),
    ).toHaveAttribute(
      "href",
      `https://explorer.testnet.evm.dusk.network/address/${recipient}`,
    );
    expect(valueOf(container, /^amount$/i)).toBe("0.5 DUSK");
    await vi.waitFor(() => {
      expect(valueOf(container, /^contract$/i)).toBe(
        `DuskEVM bridge ${bridge}`,
      );
      expect(leadOf(container)).toMatch(
        /^kT5Bam…LwKbXj .* 0\.5 DUSK .* 0x5A3d…8a01 on DuskEVM$/,
      );
    });
    // Its lookup of the payment on DuskEVM ends here, with this test.
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
  });

  it("should link the DuskEVM transaction that paid a deposit, asking DuskEVM's explorer once", async () => {
    const arrival =
      "0x029e2c6ebfe60452800c97eaa2ac36f40039812679c9cee414ea6a8b1877d61b";

    // The L2 bridge paid the deposit's amount 36 seconds after its block.
    fetchSpy.mockImplementation(async () =>
      Response.json({
        items: [
          {
            from: { hash: "0x4200000000000000000000000000000000000010" },
            success: true,
            timestamp: "2024-04-16T06:39:45.000000Z",
            transaction_hash: arrival,
            value: "500000000000000000",
          },
        ],
        next_page_params: null,
      }),
    );
    appStore.setNodeInfo(apiNodeInfo);

    const { container } = render(TransactionDetails, {
      ...props,
      data: deposit,
      market: null,
    });

    await vi.waitFor(() =>
      expect(
        rowOf(container, /duskevm transaction/i)?.querySelector(
          ".transaction-details__evm-address",
        ),
      ).toHaveAttribute(
        "href",
        `https://explorer.testnet.evm.dusk.network/tx/${arrival}`,
      ),
    );
    expect(valueOf(container, /duskevm transaction/i)).toMatch(
      new RegExp(`^${arrival}\\W*$`),
    );
    // Only what was asked of DuskEVM's explorer: under load, a read another
    // test began can land here too.
    expect(
      fetchSpy.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.startsWith("https://explorer.testnet.evm.")),
    ).toStrictEqual([
      `https://explorer.testnet.evm.dusk.network/api/v2/addresses/${recipient.toLowerCase()}/internal-transactions?filter=to`,
    ]);
  });

  it("should ask DuskEVM's explorer about a deposit that went through, and nothing for one that failed or any other transaction", async () => {
    appStore.setNodeInfo(apiNodeInfo);

    // The one that went through last: the others' lookups, had they any,
    // would ask first.
    for (const data of [
      { ...deposit, txerror: "Panic" },
      transaction,
      deposit,
    ]) {
      render(TransactionDetails, { ...props, data, market: null });
    }

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("should give what each call to the stake contract did, and the DUSK a stake sends as its amount", async () => {
    const call = {
      ...transaction,
      amount: 0,
      contract: stake,
      deposit: 0,
      to: null,
    };
    /** @type {[any, string, string][]} */
    const cases = [
      [
        { ...call, deposit: 442_409_461_511, method: "stake" },
        "Stake",
        "442.409461511 DUSK",
      ],
      [{ ...call, method: "unstake" }, "Unstake", "0 DUSK"],
      [{ ...call, method: "withdraw" }, "Claim rewards", "0 DUSK"],
    ];

    for (const [data, type, amount] of cases) {
      const { container } = render(TransactionDetails, {
        ...props,
        data,
        market: null,
      });

      await vi.waitFor(() => expect(valueOf(container, /^type$/i)).toBe(type));
      expect(valueOf(container, /^amount$/i)).toBe(amount);
      expect(valueOf(container, /^contract$/i)).toBe(`Stake contract ${stake}`);
      cleanup();
    }
  });
});
