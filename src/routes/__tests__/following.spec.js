import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { createFakeNode } from "$lib/mock-data/fakeNode";

import HomePage from "../+page.svelte";

vi.hoisted(() => {
  vi.useFakeTimers();
});

// The map's countries are drawn in full elsewhere.
vi.mock("$lib/components", async (importOriginal) => {
  /** @type {import("$lib/components")} */
  const original = await importOriginal();
  const { default: WorldMapStub } =
    await import("$lib/containers/__tests__/test-components/WorldMapStub.svelte");

  return { ...original, WorldMap: WorldMapStub };
});

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryNames: vi.fn().mockResolvedValue(new Map()),
}));

describe("The home page, following the chain", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/components");
    vi.doUnmock("$lib/dusk-domains");
  });

  it("should show each block as the node announces it and keep the numbers up to date, asking for the provisioners twice in five minutes and for nothing but the new blocks between", async () => {
    const fake = createFakeNode();

    vi.stubGlobal("fetch", fake.fetch);
    vi.stubGlobal("WebSocket", fake.WebSocket);

    const { container } = render(HomePage);
    const lastBlock = () =>
      container
        .querySelectorAll(".statistics-panel__statistics-item--primary")[1]
        ?.querySelector(".statistics-panel__statistics-item-value")
        ?.textContent?.replace(/\D/g, "");
    const listed = () =>
      Array.from(
        container.querySelectorAll(".latest-blocks-card a[href*='block?id=']"),
        (a) =>
          new URL(
            String(a.getAttribute("href")),
            "http://localhost"
          ).searchParams.get("id")
      );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(lastBlock()).toBe(String(fake.tip));
    expect(listed()).toHaveLength(15);

    const opened = fake.log.length;
    let withTransactions = 0;

    // Five minutes, a block every ten seconds, one in ten with a transaction.
    for (let n = 1; n <= 30; n += 1) {
      await vi.advanceTimersByTimeAsync(10_000);

      const block = fake.mine(n % 10 === 0 ? 1 : 0);

      withTransactions += block.transactions.length ? 1 : 0;
      await vi.advanceTimersByTimeAsync(500);

      // Within half a second of the node announcing it.
      expect(listed()[0]).toBe(block.hash);
      expect(lastBlock()).toBe(String(block.height));
    }

    const since = fake.log.slice(opened);
    const graphql = since.filter((r) => r.path === "/on/graphql/query");

    // The provisioners at the start and five minutes on.
    expect(fake.requests("/on/node/provisioners")).toHaveLength(2);
    // The count again for each block with transactions, and with the provisioners.
    expect(since.filter((r) => r.path === "/on/stats/tx_count")).toHaveLength(
      withTransactions + 1
    );
    // Each new block read once, and the last block never asked for.
    expect(graphql).toHaveLength(30);
    expect(graphql.every((r) => r.fields.join() === "block,blocks")).toBe(true);
    // As a browser sends it without asking first: text, and no other header.
    expect(
      fake.log
        .filter((r) => r.path === "/on/graphql/query")
        .every(
          (r) =>
            JSON.stringify(r.headers) ===
            JSON.stringify({ "Content-Type": "text/plain" })
        )
    ).toBe(true);
  }, 30_000);
});
