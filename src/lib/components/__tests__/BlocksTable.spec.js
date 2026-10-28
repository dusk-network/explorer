import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { mapWith, slice } from "lamb";

import { gqlBlocks } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";

import { BlocksTable } from "..";

describe("Blocks Table", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const transformBlocks = mapWith(transformBlock);
  const data = slice(transformBlocks(gqlBlocks.blocks), 0, 10);

  const baseProps = {
    data: data,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should render the `BlocksTable` component", () => {
    const { container } = render(BlocksTable, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  /** @param {HTMLElement} container */
  const getHeaders = (container) =>
    Array.from(container.querySelectorAll("th"), (th) =>
      th.textContent?.trim()
    );

  it("should give gas on the blocks page, and leave it out on the home page", async () => {
    const { container, rerender } = render(BlocksTable, baseOptions);

    expect(getHeaders(container)).toStrictEqual([
      "Block",
      "Transactions",
      "Gas used",
      "Reward",
    ]);

    await rerender({ ...baseProps, showGas: false });

    expect(getHeaders(container)).toStrictEqual([
      "Block",
      "Transactions",
      "Reward",
    ]);
  });

  it("should give a block's average gas price only when it has one", () => {
    const [block] = data;
    const { container } = render(BlocksTable, {
      props: {
        data: [
          {
            ...block,
            transactions: {
              ...block.transactions,
              stats: { ...block.transactions.stats, averageGasPrice: 1 },
            },
          },
          {
            ...block,
            header: { ...block.header, hash: "other" },
            transactions: {
              ...block.transactions,
              stats: { ...block.transactions.stats, averageGasPrice: 0 },
            },
          },
        ],
      },
    });
    const rows = container.querySelectorAll("tbody tr");

    expect(rows[0].querySelector(".block__gas-price")).not.toBeNull();
    expect(rows[1].querySelector(".block__gas-price")).toBeNull();
  });
});
