import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { TransactionDetails } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
}));

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/*
 * A detail page's rows: from 1024 px up, the labels in a column of their
 * own and each value right after its label; narrower, a long value under
 * its label. The styles, which tests don't load by themselves, decide it.
 */
describe("Detail rows", () => {
  /** @type {HTMLStyleElement} */
  let style;

  /**
   * The detail pages' styles on a screen 1024 px wide or wider, or on a
   * narrower one. jsdom has no screen: the media queries are set by hand.
   *
   * @param {"wide" | "narrow"} screen
   */
  const loadStyles = (screen) => {
    const css = [
      "../../../style/app-components/details.css",
      "../list-item/ListItem.css",
    ]
      .map(readCss)
      .join("\n");

    style = document.createElement("style");
    style.textContent = css
      .replaceAll(
        "@media (min-width: 64rem)",
        screen === "wide" ? "@media all" : "@media not all"
      )
      .replaceAll("@media (max-width: 47.99rem)", "@media not all");
    document.head.append(style);
  };

  /** @param {string} term */
  const rowOf = (term) => {
    const dt = /** @type {Element} */ (
      Array.from(document.querySelectorAll("dt")).find(
        (el) => el.textContent?.trim() === term
      )
    );

    return { dd: /** @type {Element} */ (dt.nextElementSibling), dt };
  };

  const renderDetails = () =>
    render(TransactionDetails, {
      data: transformTransaction(gqlTransaction.tx),
      error: null,
      loading: false,
      market: null,
    });

  afterEach(() => {
    cleanup();
    style.remove();
  });

  it("should set the labels in a column and each value, then its Copy, right after its label from 1024 px up", () => {
    loadStyles("wide");

    const { container } = renderDetails();
    const list = /** @type {Element} */ (
      container.querySelector(".detail-rows")
    );
    const from = rowOf("From");
    const amount = rowOf("Amount");

    expect(getComputedStyle(list).gridTemplateColumns).toBe(
      "11rem minmax(0, 1fr)"
    );
    // A long value beside its label, not under it.
    expect(getComputedStyle(from.dt).gridColumn).toBe("auto");
    expect(getComputedStyle(from.dd).gridColumn).toBe("auto");
    expect(getComputedStyle(from.dd).justifyContent).toBe("flex-start");
    expect(getComputedStyle(from.dd).alignItems).toBe("flex-start");
    // A short one at the start of its column, not at the far end.
    expect(getComputedStyle(amount.dd).justifyContent).toBe("flex-start");
    expect(getComputedStyle(amount.dd).textAlign).toBe("left");
  });

  it("should put a long value under its label, and a short one at the row's end, on narrower screens", () => {
    loadStyles("narrow");

    renderDetails();

    const from = rowOf("From");
    const amount = rowOf("Amount");

    expect(getComputedStyle(from.dt).gridColumn).toBe("1 / -1");
    expect(getComputedStyle(from.dd).gridColumn).toBe("1 / -1");
    expect(getComputedStyle(amount.dd).justifyContent).toBe("flex-end");
    expect(getComputedStyle(amount.dd).textAlign).toBe("right");
  });
});
