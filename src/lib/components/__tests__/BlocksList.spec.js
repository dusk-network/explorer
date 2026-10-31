import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";
import { getRelativeTimeString } from "$lib/dusk/string";

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
});
