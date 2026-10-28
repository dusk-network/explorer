import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { compose, mapWith, take } from "lamb";

import { gqlTransactions } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionsCard } from "..";

describe("Transactions Card", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const getTenTransactions = compose(mapWith(transformTransaction), take(10));
  const data = getTenTransactions(gqlTransactions.transactions);

  const baseProps = {
    error: null,
    isSmallScreen: false,
    loading: false,
    txns: null,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should render the `TransactionsCard` component", () => {
    const { container } = render(TransactionsCard, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show no `Show More` button while the card is loading", async () => {
    const loading = true;

    const { container, queryByRole } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...baseProps, loading },
    });

    expect(
      queryByRole("button", { name: "Show More" })
    ).not.toBeInTheDocument();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should give the count and the `Show More` button at the bottom of the list", async () => {
    const txns = mapWith(transformTransaction)(
      take(20)(gqlTransactions.transactions)
    );
    const { container, getByRole, queryByRole } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...baseProps, txns },
    });
    const footer = /** @type {HTMLElement} */ (
      container.querySelector(".data-card__footer")
    );

    expect(
      container.querySelector(".data-card__header-title")
    ).toHaveTextContent(/^Transactions$/);
    expect(footer).toHaveTextContent("15 of 20");
    expect(
      footer.compareDocumentPosition(
        /** @type {HTMLElement} */ (container.querySelector("table"))
      )
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    await fireEvent.click(getByRole("button", { name: "Show More" }));

    expect(footer).toHaveTextContent("20 of 20");
    expect(
      queryByRole("button", { name: "Show More" })
    ).not.toBeInTheDocument();
  });

  it("should hide the `Show More` button if there is no more data to display", async () => {
    const loading = false;
    const txns = data;

    const { container, queryByRole } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...baseProps, loading, txns },
    });

    expect(
      queryByRole("button", { name: "Show More" })
    ).not.toBeInTheDocument();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should hide the `Show More` button if an error has occurred", async () => {
    const props = { ...baseProps, error: new Error("error") };

    const { container } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...props, error: new Error("error") },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
