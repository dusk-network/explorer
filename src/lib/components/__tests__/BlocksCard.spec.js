import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { compose, mapWith, take } from "lamb";

import { gqlBlocks } from "$lib/mock-data";
import { transformBlock } from "$lib/chain-info";
import { BlocksCard } from "..";

describe("Blocks Card", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const getTenBlocks = compose(mapWith(transformBlock), take(10));
  const data = getTenBlocks(gqlBlocks.blocks);

  const baseProps = {
    blocks: null,
    error: null,
    isSmallScreen: false,
    loading: false,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should render the `BlocksCard` component", () => {
    const { container } = render(BlocksCard, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show no `Show more` button while the card is loading", () => {
    const loading = true;

    const { container, queryByRole } = render(BlocksCard, {
      ...baseOptions,
      props: { ...baseProps, loading },
    });

    expect(queryByRole("button", { name: "Show more" })).toBeNull();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should give the count and the `Show more` button at the bottom of the list", async () => {
    const blocks = mapWith(transformBlock)(take(20)(gqlBlocks.blocks));
    const { container, getByRole, queryByRole } = render(BlocksCard, {
      ...baseOptions,
      props: { ...baseProps, blocks },
    });
    const footer = /** @type {HTMLElement} */ (
      container.querySelector(".data-card__footer")
    );

    expect(
      getByRole("heading", { level: 1, name: "Blocks" })
    ).toBeInTheDocument();
    expect(footer).toHaveTextContent("15 of 20");
    expect(
      footer.compareDocumentPosition(
        /** @type {HTMLElement} */ (container.querySelector("table"))
      )
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    await fireEvent.click(getByRole("button", { name: "Show more" }));

    expect(footer).toHaveTextContent("20 of 20");
    expect(queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("should hide the `Show more` button if there is no more data to display", async () => {
    const loading = false;
    const blocks = data;

    const { container, queryByRole } = render(BlocksCard, {
      ...baseOptions,
      props: { ...baseProps, blocks, loading },
    });

    expect(queryByRole("button", { name: "Show more" })).toBeNull();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should hide the `Show more` button if an error has occurred", async () => {
    const props = { ...baseProps, error: new Error("error") };

    const { container } = render(BlocksCard, {
      ...baseOptions,
      props: { ...props, error: new Error("error") },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
