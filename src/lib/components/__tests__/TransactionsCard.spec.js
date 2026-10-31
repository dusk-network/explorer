import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { mapWith, take } from "lamb";

import { gqlTransaction, gqlTransactions } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { getPrimaryNames } from "$lib/dusk-domains";

import { TransactionsCard } from "..";

import { itShowsItsListAPageAtATime } from "./pagedCard";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryNames: vi.fn().mockResolvedValue(new Map()),
}));

describe("Transactions Card", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  /** @param {number} count */
  const transactions = (count) =>
    mapWith(transformTransaction)(take(count)(gqlTransactions.transactions));

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

  itShowsItsListAPageAtATime({
    Card: TransactionsCard,
    few: transactions(10),
    list: "txns",
    many: transactions(20),
    name: "TransactionsCard",
    props: baseProps,
    title: "Transactions",
  });

  it("should ask its page for more once its rows pass what it holds, say it loads until they come, and give no count while more may come", async () => {
    const more = vi.fn();
    const props = { ...baseProps, more, txns: transactions(20) };
    const { container, getByRole, rerender } = render(TransactionsCard, {
      ...baseOptions,
      props,
    });
    const rows = () => container.querySelectorAll("tbody tr");
    const footer = () =>
      /** @type {HTMLElement} */ (
        container.querySelector(".data-card__footer")
      );

    expect(rows()).toHaveLength(15);
    expect(footer().querySelector(".data-card__count")).toBeNull();

    await fireEvent.click(getByRole("button", { name: "Show more" }));

    expect(more).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(20);
    expect(getByRole("button", { name: "Loading…" })).toBeDisabled();

    // Clicked again while they load: asked once.
    await fireEvent.click(getByRole("button", { name: "Loading…" }));
    expect(more).toHaveBeenCalledTimes(1);

    // The page gives the rest, all there is.
    await rerender({ ...props, more: undefined, txns: transactions(25) });

    expect(rows()).toHaveLength(25);
    expect(footer()).toHaveTextContent("25 of 25");
    expect(footer().querySelector("button")).toBeNull();
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
        name: `${bob.slice(0, 6)}…${bob.slice(-6)}`,
      })
    ).toHaveLength(15);
  });
});
