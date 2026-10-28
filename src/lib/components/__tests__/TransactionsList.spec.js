import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

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
    mode: "full",
  };

  const timeRefreshInterval = 1000;

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should render the `TransactionsList` component in "full" mode', () => {
    const { container } = render(TransactionsList, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it('should render the `TransactionsList` component in "compact" mode', () => {
    /** @type {import("svelte").ComponentProps<TransactionsList>} */
    const props = {
      ...baseProps,
      mode: "compact",
    };
    const { container } = render(TransactionsList, { ...baseProps, ...props });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show the sender, receiver and amount instead of the gas", () => {
    const { container, rerender } = render(TransactionsList, baseProps);
    const getTerms = () =>
      Array.from(container.querySelectorAll("dt"), (dt) =>
        dt.textContent?.trim().toLowerCase()
      );

    expect(getTerms()).toStrictEqual([
      "id",
      "relative time",
      "from",
      "to",
      "amount",
      "fee",
      "status",
      "type",
    ]);
    expect(container.textContent).toContain("9,812.378912731 DUSK");

    rerender({ ...baseProps, mode: "compact" });

    return vi.waitFor(() => expect(getTerms()).not.toContain("fee"));
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
