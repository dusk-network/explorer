import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { createFakeNode } from "$lib/mock-data/fakeNode";

import Transactions from "../+page.svelte";

// No new block comes while the list is read.
vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {import("$lib/stores")} */
  const original = await importOriginal();
  const { writable } = await import("svelte/store");

  return {
    ...original,
    chainHeadStore: writable({ error: null, head: null }),
  };
});

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryNames: vi.fn().mockResolvedValue(new Map()),
}));

describe("Transactions page, a page at a time", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.doUnmock("$lib/stores");
    vi.doUnmock("$lib/dusk-domains");
  });

  it("should read 25 transactions, then only older ones as the list shows more, newest first and each once", async () => {
    // A transaction in every third block of the last 300.
    const tip = 1_000_000;
    const node = createFakeNode({
      tip,
      transactions: Array.from({ length: 100 }, (_, n) => tip - n * 3),
    });

    vi.stubGlobal("fetch", node.fetch);

    const { container, getByRole } = render(Transactions);
    const shown = () =>
      Array.from(
        container.querySelectorAll("tbody tr a[href*='transaction?id=']"),
        (a) =>
          new URL(
            String(a.getAttribute("href")),
            "http://localhost"
          ).searchParams.get("id")
      );
    const showMore = () => getByRole("button", { name: "Show more" });
    const newestFirst = async (/** @type {number} */ count) => {
      const answer = await node.fetch("https://node/on/graphql/query", {
        body: `query { transactions(last: ${count}) { id } }`,
        method: "POST",
      });

      return (await answer.json()).transactions.map(
        (/** @type {{ id: string }} */ t) => t.id
      );
    };
    const reads = () =>
      node
        .requests("/on/graphql/query")
        .filter(
          (r) =>
            r.fields.includes("transactions") || r.fields.includes("blockTxs")
        );

    await vi.waitFor(() => expect(shown()).toHaveLength(15));
    expect(
      reads().map((r) => r.body.match(/transactions\(last: \d+\)/)?.[0])
    ).toStrictEqual(["transactions(last: 25)"]);

    // Past the 25 read, the ones under them.
    await fireEvent.click(showMore());
    await vi.waitFor(() => expect(shown()).toHaveLength(30));
    await fireEvent.click(showMore());
    await vi.waitFor(() => expect(shown()).toHaveLength(45));
    await fireEvent.click(showMore());
    await vi.waitFor(() => expect(shown()).toHaveLength(60));

    // One read of the latest, then of older blocks only, which brought
    // enough for the next page too: none read twice.
    expect(reads().map((r) => r.fields)).toStrictEqual([
      ["transactions"],
      ["blockTxs"],
    ]);
    expect(shown()).toStrictEqual(await newestFirst(60));
  });
});
