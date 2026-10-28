import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { mapWith, slice } from "lamb";

import { STAKE_CONTRACT } from "$lib/network";
import {
  enrichedProvisioners,
  gqlBlocks,
  gqlTransaction,
  gqlTransactions,
} from "$lib/mock-data";
import { transformBlock, transformTransaction } from "$lib/chain-info";

import {
  BlocksList,
  BlocksTable,
  DuskName,
  ProvisionersTable,
  TransactionDetails,
  TransactionParty,
  TransactionsList,
  TransactionsTable,
} from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/**
 * What is in the chain's blue.
 *
 * @param {Element} container
 */
const blueOf = (container) =>
  Array.from(container.querySelectorAll(".chain-link"));

/**
 * Where a link in the blue goes, as a page and no more.
 *
 * @param {Element} link
 */
const pageOf = (link) =>
  link
    .getAttribute("href")
    ?.replace(/^\/some-base-path/, "")
    .split("?")[0];

/*
 * The chain's blue says a thing opens something: a block, a transaction,
 * an account, or the whole list. Nothing that opens nothing is blue.
 */
describe("Chain links", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const blocks = slice(mapWith(transformBlock)(gqlBlocks.blocks), 0, 3);
  const transactions = slice(
    mapWith(transformTransaction)(gqlTransactions.transactions),
    0,
    3
  );
  const transaction = transformTransaction(gqlTransaction.tx);

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/dusk-domains");
  });

  it("should put the blue on links only, to blocks, transactions and accounts", () => {
    const lists = [
      render(BlocksTable, { data: blocks }),
      render(BlocksList, { data: blocks[0] }),
      render(TransactionsTable, { data: transactions, mode: "full" }),
      render(TransactionsList, { data: transaction }),
      render(ProvisionersTable, { data: enrichedProvisioners.slice(0, 2) }),
    ].map(({ container }) => container);
    const blue = lists.flatMap(blueOf);

    expect(blue.length).toBeGreaterThan(0);
    expect(
      blue.filter(
        (element) => element.tagName !== "A" || !element.getAttribute("href")
      )
    ).toStrictEqual([]);
    expect([...new Set(blue.map(pageOf))].sort()).toStrictEqual([
      "/accounts/",
      "/blocks/block",
      "/transactions/transaction",
    ]);
  });

  it("should leave a phone's row, which opens a transaction, out of the blue: only the accounts in it are blue", () => {
    const { container } = render(TransactionsList, { data: transaction });

    expect(container.querySelector(".transaction-row__link")).not.toHaveClass(
      "chain-link"
    );
    expect(blueOf(container).map(pageOf)).toStrictEqual([
      "/accounts/",
      "/accounts/",
    ]);
  });

  it("should leave a transaction's own ID out of the blue on its page, with its contract, which has no page", async () => {
    const { container } = render(TransactionDetails, {
      data: {
        ...transaction,
        amount: 0,
        contract: STAKE_CONTRACT,
        deposit: 0,
        method: "withdraw",
        to: null,
      },
      error: null,
      loading: false,
      market: null,
    });
    /** @param {string} term */
    const definitionOf = (term) =>
      /** @type {Element} */ (
        Array.from(container.querySelectorAll("dt")).find(
          (dt) => dt.textContent?.trim() === term
        )?.nextElementSibling
      );

    await vi.waitFor(() =>
      expect(definitionOf("Contract")).toHaveTextContent("Stake contract")
    );

    for (const term of ["ID", "Contract"]) {
      expect(definitionOf(term).querySelector("a, .chain-link")).toBeNull();
    }

    expect(blueOf(container).map((link) => link.textContent)).toStrictEqual([
      transaction.from,
      "487,166",
    ]);
  });

  it("should leave a name without a page, and a contract without one, as plain text", async () => {
    const name = { name: "alice.dusk", url: "https://dusk.domains/alice" };
    const withPage = render(DuskName, { href: "/accounts/?key=a", name });
    const withoutPage = render(DuskName, { name });
    const contract = render(TransactionParty, {
      party: { id: STAKE_CONTRACT, kind: "contract" },
    });

    await vi.waitFor(() =>
      expect(contract.container).toHaveTextContent("Stake contract")
    );

    expect(blueOf(withPage.container).map(pageOf)).toStrictEqual([
      "/accounts/",
    ]);
    expect(blueOf(withoutPage.container)).toStrictEqual([]);
    expect(blueOf(contract.container)).toStrictEqual([]);
  });
});
