import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { STAKE_CONTRACT } from "$lib/network";
import { apiNodeInfo, gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { appStore } from "$lib/stores";

import { TransactionsList } from "..";

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/** @param {HTMLElement} container */
function getTimeElement(container) {
  return /** @type {HTMLTimeElement} */ (container.querySelector("time"));
}

describe("Transactions List", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20));

  const transaction = transformTransaction(gqlTransaction.tx);

  /** @type {import("svelte").ComponentProps<TransactionsList>} */
  const baseProps = {
    data: transaction,
  };

  /** @param {string} value */
  const short = (value) => `${value.slice(0, 6)}…${value.slice(-6)}`;

  /**
   * An address as a phone's row gives it: its first and last four
   * characters.
   *
   * @param {string} value
   */
  const shortAddress = (value) => `${value.slice(0, 4)}…${value.slice(-4)}`;

  const timeRefreshInterval = 1000;

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should render the `TransactionsList` component", () => {
    const { container } = render(TransactionsList, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show who sent how much to whom, what it did and when, and leave the rest to the transaction page", () => {
    const { container, getByRole } = render(TransactionsList, baseProps);
    const parties = /** @type {Element} */ (
      container.querySelector(".transaction-row__parties")?.cloneNode(true)
    );

    // The arrow between them is drawn, not read.
    parties
      .querySelectorAll("[aria-hidden='true']")
      .forEach((arrow) => arrow.remove());

    expect(parties.textContent?.replace(/\s+/g, " ").trim()).toBe(
      `From ${shortAddress(String(transaction.from))} To ${shortAddress(String(transaction.to))}`
    );
    expect(container.textContent).toContain("9,812.3789 DUSK");
    expect(
      Array.from(container.querySelectorAll("[title]"), (el) =>
        el.getAttribute("title")
      )
    ).toStrictEqual(["9,812.378912731 DUSK"]);
    expect(container.querySelector("time")).toHaveAttribute(
      "data-tooltip-text",
      "Tue 16 Apr 2024, 6:39:09 AM UTC"
    );
    expect(
      getByRole("link", { name: `Transaction ${short(transaction.txid)}` })
    ).toHaveAttribute(
      "href",
      `/some-base-path/transactions/transaction?id=${transaction.txid}`
    );
    expect(container.textContent).not.toMatch(/gas|fee/i);
  });

  it('should say "Contract call" for a call with no plain words when its receiver names the contract, and name the contract when the receiver is an account', async () => {
    const call = {
      ...transaction,
      amount: 0,
      contract: STAKE_CONTRACT,
      deposit: 0,
      method: "stake",
      to: null,
    };
    const toContract = render(TransactionsList, { data: call }).container;
    const toAccount = render(TransactionsList, {
      // A value sent along: the receiver is an account.
      data: { ...call, amount: 1_000_000_000, to: transaction.to },
    }).container;

    // Plain words only: the function's name is for the transaction page.
    await vi.waitFor(() => {
      expect(
        toContract.querySelector(".transaction-row__line")
      ).toHaveTextContent(/^Contract call$/);
      expect(
        toAccount.querySelector(".transaction-row__line")
      ).toHaveTextContent(/^Stake contract$/);
    });
    expect(toContract.querySelector("code")).toBeNull();
    expect(
      toAccount.querySelector(".transaction-row__parties")
    ).toHaveTextContent(`To ${shortAddress(String(transaction.to))}`);
  });

  it("should give the sender's address short, so the receiver's name keeps its room", async () => {
    const { container } = render(TransactionsList, {
      data: {
        ...transaction,
        amount: 0,
        contract: STAKE_CONTRACT,
        deposit: 0,
        method: "stake",
        to: null,
      },
    });
    const [sender, receiver] = container.querySelectorAll(
      ".transaction-row__party"
    );

    expect(sender).toHaveTextContent(
      new RegExp(`^From ${shortAddress(String(transaction.from))}$`)
    );
    await vi.waitFor(() =>
      expect(receiver).toHaveTextContent(/^To Stake contract$/)
    );
  });

  it("should name an account or a contract its network's labels name, and give another contract as its ID alone, as an address", async () => {
    const sepoliaBridge =
      "25z9o6qCaVk1ReyHjmB4pyXcE3D1vRu4FVV1rR8ChYcosdTSktkANLDHq9GD6B4985Q1S2KrDZYBRrohWAjrNmACFUb3UMSRyYctJRzh3d28R1ZNC1ZyKm1HwXL4FF5Etftt";
    const router =
      "2e4b8b46390c860282b765641fa94037812601bf777164d7b7f801a262206046";
    const rows = [
      { ...transaction, to: sepoliaBridge },
      { ...transaction, amount: 0, contract: router, method: "submit" },
    ].map(
      (data) =>
        /** @type {Element} */ (
          render(TransactionsList, { data }).container.querySelectorAll(
            ".transaction-row__party"
          )[1]
        )
    );

    await vi.waitFor(() => {
      expect(rows[0]).toHaveTextContent(`To ${shortAddress(sepoliaBridge)}`);
      expect(rows[1]).toHaveTextContent(/^To 2e4b…6046$/);
    });
    expect(
      rows[1].querySelector(".transaction-party__contract-id")
    ).not.toBeNull();
    // The words are for the tooltip and the type line.
    expect(
      rows[1].querySelector(".transaction-party--contract")
    ).toHaveAttribute("data-tooltip-text", `Contract ${router}`);
    await vi.waitFor(() =>
      expect(
        rows[1]
          .closest(".transaction-row")
          ?.querySelector(".transaction-row__line")
      ).toHaveTextContent(/^Contract call$/)
    );

    // On testnet, whose file labels both.
    await act(() => appStore.setNodeInfo(apiNodeInfo));

    await vi.waitFor(() => {
      expect(rows[0]).toHaveTextContent(/^To Sepolia bridge$/);
      expect(rows[1]).toHaveTextContent(/^To DuskEVM transaction router$/);
    });

    await act(() =>
      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined })
    );
  });

  it("should say a failure first, and mute and strike through what it didn't send", async () => {
    const style = document.createElement("style");

    style.textContent = readCss("../../../style/app-components/rows.css");
    document.head.append(style);

    const { container } = render(TransactionsList, {
      ...baseProps,
      data: { ...transaction, txerror: "Panic" },
    });
    const amount = /** @type {Element} */ (
      container.querySelector(".row-amount")
    );

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-row__line")
      ).toHaveTextContent(/^Failed · Transfer$/)
    );
    expect(amount).toHaveClass("row-amount--muted");
    expect(getComputedStyle(amount).textDecoration).toContain("line-through");
    expect(amount.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "9,812.3789 DUSK, nothing sent"
    );

    style.remove();
  });

  it("should give a named account's address in its tooltip as every Dusk app shortens it: the row is narrow, the tooltip isn't", () => {
    const sender = String(transaction.from);
    const { getByRole } = render(TransactionsList, {
      ...baseProps,
      names: new Map([
        [sender, { name: "alice.dusk", url: "https://dusk.domains/alice" }],
      ]),
    });

    expect(getByRole("link", { name: "alice.dusk" })).toHaveAttribute(
      "data-tooltip-text",
      `alice.dusk · ${short(sender)}`
    );
  });

  it("should show the DuskEVM address a deposit pays, and leave its DuskEVM transaction to its page", async () => {
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await act(() => appStore.setNodeInfo(apiNodeInfo));

    const { container } = render(TransactionsList, {
      data: {
        ...transaction,
        amount: 0,
        contract: bridge,
        deposit: 500_000_000,
        method: "depositETHToWithValue",
        payload: /** @type {any} */ ({
          call: {
            // eslint-disable-next-line camelcase
            fn_args: "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==",
          },
        }),
        to: null,
      },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-party--evm")
      ).toHaveTextContent(/^0x5A3d…8a01 on DuskEVM$/)
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    await act(() =>
      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined })
    );
  });

  it("should auto-refresh relative times when the related prop is set to true", async () => {
    const props = {
      ...baseProps,
      data: {
        ...transaction,
        date: new Date(),
      },
    };
    const { container, rerender } = render(TransactionsList, props);
    const timeElement = getTimeElement(container);

    expect(timeElement.innerHTML).toMatchInlineSnapshot(`"<!---->now<!---->"`);

    await vi.advanceTimersByTimeAsync(timeRefreshInterval * 3);

    expect(timeElement.innerHTML).toMatchInlineSnapshot(`"<!---->now<!---->"`);

    await rerender({ ...props, autoRefreshTime: true });

    expect(timeElement.innerHTML).toMatchInlineSnapshot(
      `"<!----><!----><!---->3 seconds ago<!---->"`
    );

    await vi.advanceTimersByTimeAsync(timeRefreshInterval);

    expect(timeElement.innerHTML).toMatchInlineSnapshot(
      `"<!----><!----><!---->4 seconds ago<!---->"`
    );

    await vi.advanceTimersByTimeAsync(timeRefreshInterval);

    expect(timeElement.innerHTML).toMatchInlineSnapshot(
      `"<!----><!----><!---->5 seconds ago<!---->"`
    );
  });
});
