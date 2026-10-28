import { expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";

/** A card shows its list 15 rows at a time. */
const PAGE = 15;

/**
 * What every card with a list shown a page at a time does: no "Show more"
 * while it loads, after an error, or once the whole list shows; else the
 * count and "Show more" at the bottom of the list.
 *
 * @param {{
 *   Card: any,
 *   name: string,
 *   title: string,
 *   props: Record<string, unknown>,
 *   list: string,
 *   few: unknown[],
 *   many: unknown[],
 *   total?: number,
 * }} card `list` is the prop that takes the rows; `few` fit on a page and
 *   `many` don't; `total` is how many of `many` the card lists.
 */
export function itShowsItsListAPageAtATime({
  Card,
  few,
  list,
  many,
  name,
  props,
  title,
  total = many.length,
}) {
  /** @param {Record<string, unknown>} more */
  const show = (more) =>
    render(Card, { props: { ...props, ...more }, target: document.body });

  const showMore = { name: "Show more" };

  it(`should render the \`${name}\` component`, () => {
    expect(show({}).container.firstElementChild).toMatchSnapshot();
  });

  it("should show no `Show more` button while the card is loading", () => {
    const card = show({ loading: true });

    expect(card.queryByRole("button", showMore)).toBeNull();
    expect(card.container.firstElementChild).toMatchSnapshot();
  });

  it("should give the count and the `Show more` button at the bottom of the list", async () => {
    const card = show({ [list]: many });
    const footer = /** @type {HTMLElement} */ (
      card.container.querySelector(".data-card__footer")
    );

    expect(
      card.getByRole("heading", { level: 1, name: title })
    ).toBeInTheDocument();
    expect(footer).toHaveTextContent(`${PAGE} of ${total}`);
    expect(
      footer.compareDocumentPosition(
        /** @type {HTMLElement} */ (card.container.querySelector("table"))
      )
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    await fireEvent.click(card.getByRole("button", showMore));

    expect(footer).toHaveTextContent(
      `${Math.min(2 * PAGE, total)} of ${total}`
    );
    expect(card.queryByRole("button", showMore) !== null).toBe(
      total > 2 * PAGE
    );
  });

  it("should hide the `Show more` button if there is no more data to display", () => {
    const card = show({ [list]: few });

    expect(card.queryByRole("button", showMore)).toBeNull();
    expect(card.container.firstElementChild).toMatchSnapshot();
  });

  it("should hide the `Show more` button if an error has occurred", () => {
    expect(
      show({ error: new Error("error") }).container.firstElementChild
    ).toMatchSnapshot();
  });
}
