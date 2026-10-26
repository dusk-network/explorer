import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionType } from "..";

const transaction = vi.hoisted(() => ({ from: "" }));

// An account page, for the transaction's sender.
vi.mock("$app/stores", async (importOriginal) => {
  const { readable } = await import("svelte/store");
  const { gqlTransaction: tx } = await import("$lib/mock-data");

  transaction.from = JSON.parse(tx.tx.tx.json ?? "{}").sender;

  return {
    .../** @type {object} */ (await importOriginal()),
    page: readable({
      url: new URL(`http://localhost/accounts/?key=${transaction.from}`),
    }),
  };
});

describe("TransactionType on an account page", () => {
  const transfer = transformTransaction(gqlTransaction.tx);

  afterEach(cleanup);

  afterAll(() => {
    vi.doUnmock("$app/stores");
  });

  it.each([
    ["out", transfer],
    ["in", { ...transfer, from: transfer.to, to: transfer.from }],
    // The node leaves the receiver out when it is the sender.
    ["self", { ...transfer, to: null }],
  ])("should mark a transfer %s", (direction, data) => {
    const { getByText } = render(TransactionType, { props: { data } });

    expect(getByText(direction)).toHaveClass(
      "transaction-type__direction-badge"
    );
  });
});
