import { afterAll, afterEach, describe, vi } from "vitest";
import { cleanup } from "@testing-library/svelte";
import { mapWith, take } from "lamb";

import { gqlBlocks } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";
import { BlocksCard } from "..";

import { itShowsItsListAPageAtATime } from "./pagedCard";

describe("Blocks Card", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  /** @param {number} count */
  const blocks = (count) =>
    mapWith(transformBlock)(take(count)(gqlBlocks.blocks));

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  itShowsItsListAPageAtATime({
    Card: BlocksCard,
    few: blocks(10),
    list: "blocks",
    many: blocks(20),
    name: "BlocksCard",
    props: { blocks: null, error: null, isSmallScreen: false, loading: false },
    title: "Blocks",
  });
});
