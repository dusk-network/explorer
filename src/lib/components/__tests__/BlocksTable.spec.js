import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock, gqlBlocks } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";

import { BlocksTable } from "..";

/*
 * A table of blocks: the figures each row gives, whatever its words.
 */
describe("Blocks Table", () => {
  afterEach(cleanup);

  it("should give a block's reward, the fees it took and how full it was, in full on hover, and no more for an empty one", () => {
    // Two transactions, 580,718 gas of 5,000,000,000, and 580,718 LUX in fees.
    const busy = transformBlock(gqlBlock.block);
    const empty = transformBlock(gqlBlocks.blocks[0]);
    const { container } = render(BlocksTable, {
      props: { data: [busy, empty] },
    });
    const [busyRow, emptyRow] = container.querySelectorAll("tbody tr");
    const [full, fees] = busyRow.querySelectorAll(".block__line");

    for (const row of [busyRow, emptyRow]) {
      expect(row.querySelector(".row-amount")).toHaveTextContent(/^16 DUSK$/);
      expect(row.querySelector(".row-amount [title]")).toHaveAttribute(
        "title",
        "16 DUSK",
      );
    }
    expect(full).toHaveTextContent(/^0\.01%/);
    expect(full).toHaveAttribute(
      "title",
      expect.stringMatching(/^580,718\D+5,000,000,000\b/),
    );
    expect(fees).toHaveTextContent(/^\+ ?0\.00058 DUSK\b/);
    expect(fees).toHaveAttribute("title", "0.000580718 DUSK");
    expect(emptyRow.querySelectorAll(".block__line")).toHaveLength(0);
  });
});
