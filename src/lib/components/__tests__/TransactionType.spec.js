import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionType } from "..";

describe("TransactionType", () => {
  const transaction = transformTransaction(gqlTransaction.tx);

  afterEach(cleanup);

  it.each([
    ["Moonlight", "Public"],
    ["Phoenix", "Shielded"],
  ])("should say in words that a %s transaction is %s", (txtype, label) => {
    const { getByText } = render(TransactionType, {
      props: { data: { ...transaction, txtype } },
    });

    expect(getByText(label)).toHaveClass("transaction-type__privacy");
  });
});
