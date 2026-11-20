import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import TransactionPage from "../+page.svelte";

const { id } = vi.hoisted(() => ({ id: "ab".repeat(32) }));

vi.mock("$app/stores", async (importOriginal) => {
  const { readable } = await import("svelte/store");

  return {
    .../** @type {object} */ (await importOriginal()),
    page: readable({
      url: new URL(`http://localhost/transactions/transaction/?id=${id}`),
    }),
  };
});

/**
 * Whether words say a transaction waits for a block.
 *
 * @param {string} text
 */
const saysPending = (text) =>
  /\b(mempool|pending|not yet|being processed|once it's in a block)\b/i.test(
    text,
  );

/**
 * Whether words say a transaction is confirmed: "confirmed", but for "not
 * (yet) (been) confirmed".
 *
 * @param {string} text
 */
const saysConfirmed = (text) =>
  /\bconfirmed\b/i.test(
    text.replace(/\bnot (?:yet )?(?:been )?confirmed\b/gi, ""),
  );

/*
 * A transaction the node holds in its mempool, not yet in a block.
 */
describe("Transaction page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.doUnmock("$app/stores");
  });

  it("should show a transaction in the mempool as being processed, with words that say so, and no details", async () => {
    // No block has it, the mempool does.
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ tx: null }))
      .mockResolvedValueOnce(Response.json({ mempoolTx: true }));

    vi.stubGlobal("fetch", fetch);

    const { container } = render(TransactionPage);

    await vi.waitFor(() =>
      expect(container.querySelector(".dusk-banner--info")).not.toBeNull(),
    );

    const banner = /** @type {Element} */ (
      container.querySelector(".dusk-banner--info")?.cloneNode(true)
    );

    const title = banner.querySelector(".dusk-banner__title");

    // Its state, in words: being processed.
    expect(saysPending(title?.textContent ?? "")).toBe(true);
    title?.remove();

    // And the node's words under it: waiting for a block, never confirmed.
    const body = banner.textContent?.replace(/\s+/g, " ").trim() ?? "";

    expect(body).toMatch(/\w/);
    expect(saysPending(body)).toBe(true);
    expect(saysConfirmed(body)).toBe(false);
    expect(container.querySelector(".transaction-details__outcome")).toBeNull();
    expect(String(fetch.mock.calls[0][1]?.body)).toContain(id);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
