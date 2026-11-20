import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { STAKE_CONTRACT } from "$lib/network";
import { apiNodeInfo, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { appStore } from "$lib/stores";

import { TransactionsTable } from "..";

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/**
 * What a part of a row shows on screen.
 *
 * @param {Element} row
 * @param {string} selector
 */
const shownIn = (row, selector) => {
  const part = /** @type {Element} */ (
    row.querySelector(selector)?.cloneNode(true)
  );

  part.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());

  return part.textContent?.replace(/\s+/g, " ").trim();
};

/*
 * A table of transactions: the accounts, the figures and the state each
 * row shows, whatever its words.
 */
describe("Transactions Table", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const transfer = transformTransaction(gqlTransaction.tx);
  const sender = String(transfer.from);
  const receiver = String(transfer.to);
  /** @param {string} id */
  const short = (id) => `${id.slice(0, 6)}…${id.slice(-6)}`;

  afterEach(() => {
    cleanup();
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should give the sender and the receiver on their own accounts, the amount and the fee in full on hover, and the ID, short in its case, opening the transaction and copied whole", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    const { container } = render(TransactionsTable, {
      props: { data: [transfer], mode: "full" },
    });
    const [row] = container.querySelectorAll("tbody tr");
    const id = /** @type {Element} */ (row.querySelector(".transaction__link"));

    expect(
      Array.from(
        row.querySelectorAll(".transaction-party--account"),
        (party) => [party.textContent?.trim(), party.getAttribute("href")],
      ),
    ).toStrictEqual([
      [short(sender), `/some-base-path/accounts/?key=${sender}`],
      [short(receiver), `/some-base-path/accounts/?key=${receiver}`],
    ]);
    expect(shownIn(row, ".row-amount")).toBe("9,812.3789 DUSK");
    expect(row.querySelector(".row-amount [title]")).toHaveAttribute(
      "title",
      "9,812.378912731 DUSK",
    );
    // Under 0.01 DUSK, a fee keeps two significant digits, to the nearest.
    expect(shownIn(row, ".transaction__fee")).toBe("0.00029 DUSK");
    expect(row.querySelector(".transaction__fee [title]")).toHaveAttribute(
      "title",
      "0.000290766 DUSK",
    );
    expect(id.textContent?.trim()).toBe(short(transfer.txid));
    expect(id).toHaveAttribute(
      "href",
      `/some-base-path/transactions/transaction?id=${transfer.txid}`,
    );

    await fireEvent.click(
      /** @type {Element} */ (
        id
          .closest(".transaction__transaction-id-container")
          ?.querySelector("button")
      ),
    );

    expect(writeText).toHaveBeenCalledExactlyOnceWith(transfer.txid);
  });

  it("should sign each amount by which way it went for the account whose page it is", () => {
    const { container } = render(TransactionsTable, {
      props: {
        account: sender,
        data: [
          transfer,
          { ...transfer, from: receiver, to: sender, txid: "e".repeat(64) },
        ],
        mode: "full",
      },
    });

    expect(
      Array.from(container.querySelectorAll("tbody tr"), (row) =>
        shownIn(row, ".row-amount"),
      ),
    ).toStrictEqual(["−9,812.3789 DUSK", "+9,812.3789 DUSK"]);
  });

  it("should mark a failed transaction failed, and strike through what it would have sent", () => {
    const style = document.createElement("style");

    style.textContent = readCss("../../../style/app-components/rows.css");
    document.head.append(style);

    // A shield: 20 DUSK to the transfer contract, failed and then done;
    // and a failed reward claim, which would have sent nothing.
    const shield = {
      ...transfer,
      amount: 0,
      contract: `01${"0".repeat(62)}`,
      deposit: 20_000_000_000,
      method: "convert",
      to: null,
      txerror: "Panic",
      txid: "f".repeat(64),
    };
    const claim = {
      ...shield,
      contract: STAKE_CONTRACT,
      deposit: 0,
      method: "withdraw",
      txid: "d".repeat(64),
    };
    const { container } = render(TransactionsTable, {
      props: {
        account: sender,
        data: [shield, claim, { ...shield, txerror: "", txid: "e".repeat(64) }],
        mode: "full",
      },
    });

    expect(
      Array.from(container.querySelectorAll("tbody tr"), (row) => ({
        amount: shownIn(row, ".row-amount"),
        // The status it shows in words: "Failed" first, or none.
        line: row
          .querySelector(".transaction__line")
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
        struck: getComputedStyle(
          /** @type {Element} */ (row.querySelector(".row-amount")),
        ).textDecoration.includes("line-through"),
      })),
    ).toStrictEqual([
      {
        amount: "20 DUSK",
        line: expect.stringMatching(/^Failed\b/),
        struck: true,
      },
      {
        amount: "0 DUSK",
        line: expect.stringMatching(/^Failed\b/),
        struck: false,
      },
      {
        amount: "−20 DUSK",
        line: expect.not.stringMatching(/Failed/),
        struck: false,
      },
    ]);

    style.remove();
  });

  it("should give the DuskEVM address a deposit pays, on DuskEVM, and ask DuskEVM's explorer nothing", async () => {
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    appStore.setNodeInfo(apiNodeInfo);

    const { container } = render(TransactionsTable, {
      props: {
        data: [
          {
            ...transfer,
            amount: 0,
            contract: bridge,
            deposit: 500_000_000,
            method: "depositETHToWithValue",
            payload: /** @type {any} */ ({
              call: {
                fn_args:
                  "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==",
              },
            }),
            to: null,
          },
        ],
        mode: "full",
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
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
