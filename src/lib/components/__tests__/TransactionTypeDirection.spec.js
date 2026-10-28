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
    ["Sent", transfer],
    ["Received", { ...transfer, from: transfer.to, to: transfer.from }],
    // The node leaves the receiver out when it is the sender.
    ["Sent to itself", { ...transfer, to: null }],
  ])("should say a transfer was %s", (words, data) => {
    const { getByText } = render(TransactionType, { props: { data } });

    expect(getByText(words)).toHaveClass("transaction-type__direction");
  });

  it("should keep a call's own words, its way shown by the row's sign", async () => {
    const { container, queryByText } = render(TransactionType, {
      props: {
        data: {
          ...transfer,
          contract:
            "0200000000000000000000000000000000000000000000000000000000000000",
          method: "withdraw",
          to: null,
        },
      },
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".transaction-type__label")
      ).toHaveTextContent("Claim rewards")
    );
    expect(queryByText("Sent")).toBeNull();
  });
});
