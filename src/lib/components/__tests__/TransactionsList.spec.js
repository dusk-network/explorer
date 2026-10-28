import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { STAKE_CONTRACT } from "$lib/constants";
import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionsList } from "..";

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
  const short = (value) => `${value.slice(0, 6)}...${value.slice(-6)}`;

  /**
   * An address as a phone's row gives it: its first and last four
   * characters, as wide as six and three dots.
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
      "Tue 16 Apr 2024, 06:39:09 UTC"
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

  it("should say a failure first, and mute what it didn't send", async () => {
    const { container } = render(TransactionsList, {
      ...baseProps,
      data: { ...transaction, txerror: "Panic" },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-row__line")
      ).toHaveTextContent(/^Failed · Transfer$/)
    );
    expect(container.querySelector(".row-amount")).toHaveClass(
      "row-amount--muted"
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
