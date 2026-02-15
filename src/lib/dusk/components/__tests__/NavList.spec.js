import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { NavList } from "..";

describe("NavList", () => {
  const baseProps = {
    navigation: [
      {
        link: "https://dusk.network",
        title: "Dusk",
      },
      {
        link: "https://explorer.dusk.network",
        title: "Explorer",
      },
    ],
  };

  afterEach(cleanup);

  it("renders the NavList component", () => {
    const { container } = render(NavList, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should render the Nav List with the correct information", () => {
    const { container } = render(NavList, baseProps);

    expect(baseProps.navigation.length).toBeGreaterThan(0);

    baseProps.navigation.forEach((item, index) => {
      const link = /** @type {HTMLAnchorElement} */ (
        container.getElementsByClassName("dusk-nav-list__link")[index]
      );

      expect(link.textContent?.trim()).toBe(item.title);

      expect(link).toHaveAttribute("href", item.link);
    });

    expect.assertions(baseProps.navigation.length * 2 + 1);
  });

  it("should pass additional class names and attributes to the rendered element", () => {
    const props = {
      ...baseProps,
      className: "foo bar",
    };
    const { container } = render(NavList, props);

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
