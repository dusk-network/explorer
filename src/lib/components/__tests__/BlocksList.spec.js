import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";
import { getRelativeTimeString, middleEllipsis } from "$lib/dusk/string";

import { BlocksList } from "..";

describe("Blocks List", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 20));

  const block = transformBlock(gqlBlock.block);

  /** @type {import("svelte").ComponentProps<BlocksList>} */
  const baseProps = { data: block };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("renders the Blocks List component", () => {
    const { container } = render(BlocksList, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("keeps a block's age up to date while no new block comes", async () => {
    const date = new Date(Date.now() - 1_000);
    const { container } = render(BlocksList, {
      data: { ...block, header: { ...block.header, date } },
    });
    const age = () => container.querySelector("time")?.textContent?.trim();

    expect(age()).toBe(getRelativeTimeString(date, "long"));

    await vi.advanceTimersByTimeAsync(2 * 60_000);

    expect(age()).toBe(getRelativeTimeString(date, "long"));
    expect(age()).toMatch(/2 minutes ago/);
  });

  it("says when and by whom a block was made, opening the generator's account, and the fees it took, if any; the home page's row says neither", async () => {
    const { container, rerender } = render(BlocksList, baseProps);
    const line = () =>
      container
        .querySelector(".block-row__main .row-line")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();
    const end = () =>
      container
        .querySelector(".block-row__end")
        ?.textContent?.replace(/\s+/g, " ")
        .trim();
    const key = block.header.generator;

    expect(line()).toBe(
      `${getRelativeTimeString(block.header.date, "long")} · by ${middleEllipsis(key, 4)}`
    );
    expect(container.querySelector(".transaction-party")).toHaveAttribute(
      "href",
      `/some-base-path/accounts/?key=${key}`
    );
    // Two transactions, which paid 580,718 LUX in fees.
    expect(end()).toBe("16 DUSK 2 transactions + 0.00058 DUSK fees");

    await rerender({
      data: { ...block, header: { ...block.header, feespaid: 0 } },
    });

    expect(end()).toBe("16 DUSK 2 transactions");

    await rerender({ brief: true, data: block });

    expect(line()).toBe(getRelativeTimeString(block.header.date, "long"));
    expect(end()).toBe("16 DUSK 2 transactions");
    expect(container.querySelector(".transaction-party")).toBeNull();
  });
});
