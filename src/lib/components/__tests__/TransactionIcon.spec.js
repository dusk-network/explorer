import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import {
  mdiArrowBottomLeft,
  mdiArrowTopRight,
  mdiCodeBraces,
  mdiEyeOffOutline,
  mdiLayersOutline,
  mdiSync,
} from "@mdi/js";

import { STAKE_CONTRACT } from "$lib/network";
import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionIcon } from "..";

describe("TransactionIcon", () => {
  const transfer = transformTransaction(gqlTransaction.tx);

  afterEach(cleanup);

  /**
   * @param {Transaction} transaction
   * @param {"in" | "out" | "self"} [direction]
   */
  const iconOf = (transaction, direction) =>
    render(TransactionIcon, { props: { direction, transaction } })
      .container.querySelector("path")
      ?.getAttribute("d");

  it("should show what a transaction did, out of screen readers' way", () => {
    const { container } = render(TransactionIcon, {
      props: { transaction: transfer },
    });

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(iconOf(transfer)).toBe(mdiArrowTopRight);
    expect(iconOf({ ...transfer, txtype: "Phoenix" })).toBe(mdiEyeOffOutline);
    expect(
      iconOf({ ...transfer, contract: STAKE_CONTRACT, method: "stake" })
    ).toBe(mdiLayersOutline);
    expect(iconOf({ ...transfer, method: "blob" })).toBe(mdiCodeBraces);
  });

  it("should turn a transfer's arrow by the way it went for an account", () => {
    expect(iconOf(transfer, "out")).toBe(mdiArrowTopRight);
    expect(iconOf(transfer, "in")).toBe(mdiArrowBottomLeft);
    expect(iconOf(transfer, "self")).toBe(mdiSync);
  });
});
