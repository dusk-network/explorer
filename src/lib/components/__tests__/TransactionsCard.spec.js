import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { compose, mapWith, take } from "lamb";

import { gqlTransaction, gqlTransactions } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { getPrimaryNames } from "$lib/dusk-domains";

import { TransactionsCard } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryNames: vi.fn().mockResolvedValue(new Map()),
}));

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

  it("should show no `Show more` button while the card is loading", async () => {
    const loading = true;

    const { container, queryByRole } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...baseProps, loading },
    });

    expect(
      queryByRole("button", { name: "Show more" })
    ).not.toBeInTheDocument();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should give the count and the `Show more` button at the bottom of the list", async () => {
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
      getByRole("heading", { level: 1, name: "Transactions" })
    ).toBeInTheDocument();
    expect(footer).toHaveTextContent("15 of 20");
    expect(
      footer.compareDocumentPosition(
        /** @type {HTMLElement} */ (container.querySelector("table"))
      )
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    await fireEvent.click(getByRole("button", { name: "Show more" }));

    expect(footer).toHaveTextContent("20 of 20");
    expect(
      queryByRole("button", { name: "Show more" })
    ).not.toBeInTheDocument();
  });

  it("should hide the `Show more` button if there is no more data to display", async () => {
    const loading = false;
    const txns = data;

    const { container, queryByRole } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...baseProps, loading, txns },
    });

    expect(
      queryByRole("button", { name: "Show more" })
    ).not.toBeInTheDocument();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should look up the names of the accounts it shows once, and show them", async () => {
    const transfer = transformTransaction(gqlTransaction.tx);
    const [alice, bob] = [
      /** @type {string} */ (transfer.from),
      /** @type {string} */ (transfer.to),
    ];
    const txns = Array.from({ length: 20 }, (_, i) => ({
      ...transfer,
      to: i < 15 ? bob : `${bob.slice(0, -1)}${i}`,
      txid: `${i}`.padStart(64, "0"),
    }));

    vi.mocked(getPrimaryNames).mockClear();
    vi.mocked(getPrimaryNames).mockResolvedValueOnce(
      new Map([
        [
          alice,
          { name: "alice.dusk", url: "https://dusk.domains/name/alice.dusk" },
        ],
        [bob, null],
      ])
    );

    const { findAllByRole, getAllByRole } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...baseProps, txns },
    });

    // The 15 rows shown have two accounts between them.
    expect(getPrimaryNames).toHaveBeenCalledExactlyOnceWith([alice, bob]);
    expect(await findAllByRole("link", { name: "alice.dusk" })).toHaveLength(
      15
    );
    expect(
      getAllByRole("link", {
        name: `${bob.slice(0, 6)}...${bob.slice(-6)}`,
      })
    ).toHaveLength(15);
  });

  it("should hide the `Show more` button if an error has occurred", async () => {
    const props = { ...baseProps, error: new Error("error") };

    const { container } = render(TransactionsCard, {
      ...baseOptions,
      props: { ...props, error: new Error("error") },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
