import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";

import { BlockDetails } from "..";

describe("Block Details", () => {
  const data = transformBlock(gqlBlock.block);

  afterEach(cleanup);

  it("should round the average gas price to two decimals, in LUX", () => {
    const { container } = render(BlockDetails, {
      data: {
        ...data,
        transactions: {
          ...data.transactions,
          stats: { ...data.transactions.stats, averageGasPrice: 1.23456789 },
        },
      },
      error: null,
      loading: false,
      payload: "",
    });

    // In its own row, found by the name of its field.
    const row = Array.from(container.querySelectorAll("dt")).find((dt) =>
      /average gas price/i.test(dt.textContent ?? ""),
    )?.nextElementSibling;

    expect(row?.textContent?.trim()).toBe("1.23 LUX");
  });

  it("should head with the word Block and its height, then its time and how many transactions it holds", () => {
    const { container } = render(BlockDetails, {
      data,
      error: null,
      loading: false,
      payload: "",
    });

    // What people read, screenshot and share: never the height alone.
    expect(
      container
        .querySelector(".block-details__summary-text")
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("Block 495,868");
    // The tests run in UTC: block 495,868 was made at 1713298022.
    expect(
      container
        .querySelector(".block-details__summary-meta")
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("16 Apr 2024, 8:07:02 PM UTC · 2 transactions");
  });
});
