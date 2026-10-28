import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { ListItem } from "../";

const baseProps = {
  tooltipText: "Tooltip text",
};

describe("List Item", () => {
  afterEach(cleanup);

  it("renders the List Item component", () => {
    const { container } = render(ListItem, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should put a wide value under its label, across the list", () => {
    const { container, rerender } = render(ListItem, baseProps);
    const term = /** @type {HTMLElement} */ (container.querySelector("dt"));
    const definition = /** @type {HTMLElement} */ (
      container.querySelector("dd")
    );

    expect(term).not.toHaveClass("details-list__term--wide");
    expect(definition).not.toHaveClass("details-list__definition--wide");

    rerender({ ...baseProps, wide: true });

    return vi.waitFor(() => {
      expect(term).toHaveClass("details-list__term--wide");
      expect(definition).toHaveClass("details-list__definition--wide");
    });
  });
});
