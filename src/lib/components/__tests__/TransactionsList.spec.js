import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { STAKE_CONTRACT } from "$lib/network";
import { apiNodeInfo, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { appStore } from "$lib/stores";

import { TransactionsList } from "..";

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * The amount a row shows, as it reads on screen.
 *
 * @param {HTMLElement} container
 */
const amountOf = (container) => {
  const amount = /** @type {Element} */ (
    container.querySelector(".row-amount")?.cloneNode(true)
  );

  amount.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());

  return amount.textContent?.replace(/\s+/g, " ").trim();
};

/*
 * A phone's row of a transaction: the accounts, the figures and the state
 * it shows, whatever its words.
 */
describe("Transactions List", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20));

  const transaction = transformTransaction(gqlTransaction.tx);
  const sender = String(transaction.from);
  const receiver = String(transaction.to);

  afterEach(() => {
    cleanup();
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should give the sender and the receiver short, in their case, on their own accounts, and the amount, in full on hover", () => {
    const { container } = render(TransactionsList, { data: transaction });

    expect(
      Array.from(
        container.querySelectorAll(".transaction-party--account"),
        (party) => [party.textContent?.trim(), party.getAttribute("href")],
      ),
    ).toStrictEqual([
      [
        `${sender.slice(0, 4)}…${sender.slice(-4)}`,
        `/some-base-path/accounts/?key=${sender}`,
      ],
      [
        `${receiver.slice(0, 4)}…${receiver.slice(-4)}`,
        `/some-base-path/accounts/?key=${receiver}`,
      ],
    ]);
    expect(amountOf(container)).toBe("9,812.3789 DUSK");
    expect(container.querySelector(".row-amount [title]")).toHaveAttribute(
      "title",
      "9,812.378912731 DUSK",
    );
    expect(container.querySelector(".transaction-row__link")).toHaveAttribute(
      "href",
      `/some-base-path/transactions/transaction?id=${transaction.txid}`,
    );
    // The fee and the gas are for the transaction's page.
    expect(container.textContent).not.toMatch(/gas|fee/i);
    for (const figure of ["0.00029", "290,766", "500,000,000"]) {
      expect(container.innerHTML).not.toContain(figure);
    }
  });

  it("should sign the amount by which way it went for the account whose page it is", () => {
    const amountFor = (/** @type {string | undefined} */ account) => {
      cleanup();

      return amountOf(
        render(TransactionsList, { account, data: transaction }).container,
      );
    };

    expect(amountFor(sender)).toBe("−9,812.3789 DUSK");
    expect(amountFor(receiver)).toBe("+9,812.3789 DUSK");
    expect(amountFor(undefined)).toBe("9,812.3789 DUSK");
  });

  it("should mark a failed transaction failed, and strike through what it would have sent", () => {
    const style = document.createElement("style");

    style.textContent = readCss("../../../style/app-components/rows.css");
    document.head.append(style);

    /** @param {any} data */
    const rowOf = (data) => {
      cleanup();

      const { container } = render(TransactionsList, { data });
      const amount = /** @type {Element} */ (
        container.querySelector(".row-amount")
      );

      return {
        amount: amountOf(container),
        // The status it shows in words: "Failed" first, or none.
        line: container
          .querySelector(".transaction-row__line")
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
        struck:
          getComputedStyle(amount).textDecoration.includes("line-through"),
      };
    };

    expect(rowOf(transaction)).toStrictEqual({
      amount: "9,812.3789 DUSK",
      line: expect.not.stringMatching(/Failed/),
      struck: false,
    });
    expect(rowOf({ ...transaction, txerror: "Panic" })).toStrictEqual({
      amount: "9,812.3789 DUSK",
      line: expect.stringMatching(/^Failed\b/),
      struck: true,
    });
    // A call's deposit doesn't reach its contract either.
    expect(
      rowOf({
        ...transaction,
        amount: 0,
        contract: STAKE_CONTRACT,
        deposit: 20_000_000_000,
        method: "stake",
        to: null,
        txerror: "Panic",
      }),
    ).toStrictEqual({
      amount: "20 DUSK",
      line: expect.stringMatching(/^Failed\b/),
      struck: true,
    });

    style.remove();
  });

  it("should give a call to the stake contract its own type: Stake, Unstake or Claim rewards", async () => {
    const call = {
      ...transaction,
      amount: 0,
      contract: STAKE_CONTRACT,
      deposit: 0,
      to: null,
    };
    const lines = [
      { ...call, deposit: 1_000_000_000_000, method: "stake" },
      { ...call, method: "unstake" },
      { ...call, method: "withdraw" },
    ].map((data) =>
      render(TransactionsList, { data }).container.querySelector(
        ".transaction-row__line",
      ),
    );

    await vi.waitFor(() => {
      expect(lines[0]).toHaveTextContent(/^Stake\b/);
      expect(lines[1]).toHaveTextContent(/^Unstake\b/);
      expect(lines[2]).toHaveTextContent(/^Claim rewards\b/);
    });
  });

  it("should give the DuskEVM address a deposit pays, on DuskEVM, and ask DuskEVM's explorer nothing", async () => {
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    appStore.setNodeInfo(apiNodeInfo);

    const { container } = render(TransactionsList, {
      data: {
        ...transaction,
        amount: 0,
        contract: bridge,
        deposit: 500_000_000,
        method: "depositETHToWithValue",
        payload: /** @type {any} */ ({
          call: {
            fn_args: "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==",
          },
        }),
        to: null,
      },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-party--evm"),
      ).toHaveTextContent(/^0x5A3d…8a01 on DuskEVM$/),
    );
    // The whole address, and its network, on hover.
    expect(container.querySelector(".transaction-party--evm")).toHaveAttribute(
      "data-tooltip-text",
      "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01 on DuskEVM",
    );
    expect(
      container.querySelector(".transaction-party__evm-address"),
    ).toHaveAttribute(
      "href",
      "https://explorer.testnet.evm.dusk.network/address/0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01",
    );
    expect(amountOf(container)).toBe("0.5 DUSK");
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
