import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { createFakeNode } from "$lib/mock-data/fakeNode";
import { hostProvisioners } from "$lib/mock-data";

import BlocksPage from "../+page.svelte";

vi.hoisted(() => {
  vi.useFakeTimers();
});

describe("The blocks page, following the chain", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should say who made each block, from the block's own query, and ask the node for nothing but each new block", async () => {
    const fake = createFakeNode();

    vi.stubGlobal("fetch", fake.fetch);
    vi.stubGlobal("WebSocket", fake.WebSocket);

    const { container } = render(BlocksPage);

    /** The fake node's blocks are made by its provisioners in turn. */
    const generatorOf = (/** @type {number} */ height) =>
      hostProvisioners[height % hostProvisioners.length].key;

    /** Each row's block, and the account its generator opens. */
    const rows = () =>
      Array.from(container.querySelectorAll("tbody tr"), (row) => {
        const block = row.querySelector("a[href*='block?id=']");
        const generator = row.querySelector("a[href*='/accounts/']");
        const param = (
          /** @type {Element | null} */ link,
          /** @type {string} */ name
        ) =>
          link
            ? new URL(
                String(link.getAttribute("href")),
                "http://localhost"
              ).searchParams.get(name)
            : null;

        return {
          block: param(block, "id"),
          generator: param(generator, "key"),
        };
      });

    await vi.advanceTimersByTimeAsync(1_000);

    // The latest blocks, the newest first, each with its generator.
    expect(rows()).toHaveLength(15);
    expect(rows().map((row) => row.generator)).toStrictEqual(
      Array.from({ length: 15 }, (_, i) => generatorOf(fake.tip - i))
    );

    const opened = fake.log.length;

    // Two minutes, a block every ten seconds, one in four with a transaction.
    for (let n = 1; n <= 12; n += 1) {
      await vi.advanceTimersByTimeAsync(10_000);

      const block = fake.mine(n % 4 === 0 ? 1 : 0);

      await vi.advanceTimersByTimeAsync(500);

      expect(rows()[0]).toStrictEqual({
        block: block.hash,
        generator: generatorOf(block.height),
      });
    }

    const since = fake.log.slice(opened);

    // Each new block read once, its generator with it, and nothing else:
    // no lookups for the generators.
    expect(since).toHaveLength(12);
    expect(
      since.every(
        (r) =>
          r.path === "/on/graphql/query" &&
          r.fields.join() === "block,blocks" &&
          r.body.includes("generatorBlsPubkey")
      )
    ).toBe(true);
  }, 30_000);
});
