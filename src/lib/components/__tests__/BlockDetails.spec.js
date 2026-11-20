import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";

import { BlockDetails } from "..";

describe("Block Details", () => {
  const data = transformBlock(gqlBlock.block);

  afterEach(cleanup);

  it("should round the average gas price to two decimals, in LUX", () => {
    const { getByText } = render(BlockDetails, {
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

    expect(getByText("1.23 LUX")).toBeInTheDocument();
  });
});
