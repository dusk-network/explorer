import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { gqlBlock, gqlTransaction } from "$lib/mock-data";
import { transformBlock, transformTransaction } from "$lib/chain-info";

import { BlocksList, TransactionsList } from "..";

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/** @param {Element} element */
const zIndexOf = (element) =>
  Number.parseInt(getComputedStyle(element).zIndex, 10) || 0;

/**
 * Whether an element is painted above its row's link, which comes after it
 * and covers the row.
 *
 * @param {Element} link
 */
const isAbove = (link) => (/** @type {Element} */ element) =>
  getComputedStyle(element).position !== "static" &&
  zIndexOf(element) > zIndexOf(link);

/*
 * A row of the phone lists is one link to its transaction or block, laid
 * over the row. The components' own styles, which tests don't load by
 * themselves, must keep what a row shows in more detail on hover above it.
 */
describe("Row links", () => {
  /** @type {HTMLStyleElement} */
  let style;

  /**
   * The lists' styles as a mouse gets them, or a touch screen. jsdom
   * applies no `(hover: hover)` rules: a mouse gets them as any other.
   *
   * @param {"mouse" | "touch"} pointer
   */
  const loadStyles = (pointer) => {
    const css = [
      "../transactions-list/TransactionsList.css",
      "../blocks-list/BlocksList.css",
    ]
      .map(readCss)
      .join("\n");

    style = document.createElement("style");
    style.textContent =
      pointer === "mouse"
        ? css.replaceAll("@media (hover: hover)", "@media all")
        : css;
    document.head.append(style);
  };

  const renderRows = () => {
    const transaction = render(TransactionsList, {
      props: { data: transformTransaction(gqlTransaction.tx) },
    }).container;
    const block = render(BlocksList, {
      props: { data: transformBlock(gqlBlock.block) },
    }).container;

    return {
      block: {
        details: [...block.querySelectorAll(".row-amount [title], time")],
        link: /** @type {Element} */ (block.querySelector(".block-row__link")),
      },
      transaction: {
        details: [...transaction.querySelectorAll(".row-amount [title], time")],
        link: /** @type {Element} */ (
          transaction.querySelector(".transaction-row__link")
        ),
        names: [...transaction.querySelectorAll(".transaction-party")],
      },
    };
  };

  afterEach(() => {
    cleanup();
    style.remove();
  });

  it("should let a mouse reach a row's names, exact amount and full time above its link", () => {
    loadStyles("mouse");

    const { block, transaction } = renderRows();

    expect(transaction.details).toHaveLength(2);
    expect(transaction.names).toHaveLength(2);
    expect(
      [...transaction.names, ...transaction.details].filter(
        (element) => !isAbove(transaction.link)(element)
      )
    ).toStrictEqual([]);
    expect(block.details).toHaveLength(2);
    expect(
      block.details.filter((el) => !isAbove(block.link)(el))
    ).toStrictEqual([]);
  });

  it("should open the row from a tap anywhere but on a name, on a touch screen", () => {
    loadStyles("touch");

    const { block, transaction } = renderRows();

    expect(transaction.names.every(isAbove(transaction.link))).toBe(true);
    expect(transaction.details.some(isAbove(transaction.link))).toBe(false);
    expect(block.details.some(isAbove(block.link))).toBe(false);
  });
});
