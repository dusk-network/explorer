import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlBlock } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";

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
});
