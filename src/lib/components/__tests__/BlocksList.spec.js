import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";

import { BlocksList } from "..";

/*
 * A phone's row of a block: the figures it gives, whatever its words.
 */
describe("Blocks List", () => {
  const block = transformBlock(gqlBlock.block);

  afterEach(cleanup);

  /**
   * The lines under the reward that give a figure in DUSK.
   *
   * @param {HTMLElement} container
   */
  const feesOf = (container) =>
    Array.from(container.querySelectorAll(".block-row__end .row-line"))
      .map((line) => line.textContent?.replace(/\s+/g, " ").trim())
      .filter((line) => line?.includes("DUSK"));

  it("should give a block's reward and the fees it took, and link who made it to its own account", async () => {
    const { container, rerender } = render(BlocksList, { data: block });

    expect(container.querySelector(".row-amount")).toHaveTextContent(
      /^16 DUSK$/,
    );
    expect(container.querySelector(".row-amount [title]")).toHaveAttribute(
      "title",
      "16 DUSK",
    );
    // Two transactions, which paid 580,718 LUX in fees.
    expect(feesOf(container)).toStrictEqual([
      expect.stringMatching(/^\+ ?0\.00058 DUSK\b/),
    ]);
    expect(container.querySelector(".transaction-party")).toHaveAttribute(
      "href",
      `/some-base-path/accounts/?key=${block.header.generator}`,
    );

    // No fees, and the home page's short row: no fee line.
    await rerender({
      data: { ...block, header: { ...block.header, feespaid: 0 } },
    });

    expect(feesOf(container)).toStrictEqual([]);

    await rerender({ brief: true, data: block });

    expect(feesOf(container)).toStrictEqual([]);
  });
});
