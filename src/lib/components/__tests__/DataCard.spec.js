import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { renderWithSimpleContent } from "$lib/dusk/test-helpers";

import { DataCard } from "..";

describe("DataCard", () => {
  const baseProps = {
    data: null,
    error: null,
    headerButtonDetails: { action: () => {}, disabled: false, label: "Button" },
    loading: false,
    title: "Title",
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  it("should give its title as written, a page's heading by default, without brackets", () => {
    const { getByRole } = render(DataCard, baseOptions);
    const heading = getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent(/^Title$/);
    expect(heading.children).toHaveLength(0);
  });

  it("should head a section of a page one level down, between brackets that are drawn, not read", () => {
    const { getByRole, queryByRole } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, variant: "section" },
    });
    const heading = getByRole("heading", { level: 2, name: "Title" });

    expect(queryByRole("heading", { level: 1 })).toBeNull();
    expect(heading).toHaveTextContent(/^\[Title\]$/);
    expect(
      Array.from(heading.children, (bracket) => [
        bracket.textContent,
        bracket.getAttribute("aria-hidden"),
      ])
    ).toStrictEqual([
      ["[", "true"],
      ["]", "true"],
    ]);
  });

  it("should head a detail page's summary as a section, its line being no page title", () => {
    const { getByRole } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, variant: "detail" },
    });
    const heading = getByRole("heading", { level: 1, name: "Title" });

    expect(heading).toHaveTextContent(/^\[Title\]$/);
    expect(heading.querySelectorAll("[aria-hidden='true']")).toHaveLength(2);
  });

  it("should link a section to the whole list, as a text link", () => {
    const { getByRole, queryByRole } = render(DataCard, {
      ...baseOptions,
      props: {
        ...baseProps,
        headerButtonDetails: undefined,
        headerLink: { href: "/blocks", label: "All blocks" },
        variant: "section",
      },
    });
    const link = getByRole("link", { name: "All blocks" });

    expect(link).toHaveAttribute("href", "/some-base-path/blocks");
    expect(link).toHaveClass("chain-link");
    expect(queryByRole("button")).toBeNull();
  });

  it("should render the `DataCard` in the loading state", () => {
    const loading = true;
    const { container } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, loading },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should render the `DataCard` in the error state", () => {
    const error = new Error("error");
    const { container } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, error },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should render the `DataCard` in the no data state", () => {
    const data = new Array(0);
    const { container } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, data },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should say what an empty list means, as its card tells it", () => {
    const { container } = render(DataCard, {
      ...baseOptions,
      props: {
        ...baseProps,
        data: [],
        emptyText: "No transactions in this block.",
      },
    });

    expect(container.querySelector(".alert")).toHaveTextContent(
      /^No transactions in this block\.$/
    );
  });

  it("should say a load failed, give its error, and offer to try again", async () => {
    const retry = vi.fn();
    const { container, getByRole } = render(DataCard, {
      ...baseOptions,
      events: { retry },
      props: { ...baseProps, error: new Error("Request timed out") },
    });

    expect(container.querySelector(".alert")).toHaveTextContent(
      /^Couldn't load this\.\s*Request timed out\s*Try again$/
    );

    await fireEvent.click(getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it("should render the `DataCard` in the data state", () => {
    const data = new Array(2);
    const renderWithSlots = renderWithSimpleContent(DataCard, {
      ...baseOptions,
      props: { ...baseProps, data },
    });

    expect(renderWithSlots.container.firstElementChild).toMatchSnapshot();
  });

  it("should render the `DataCard` in the data state when loading is true", () => {
    const data = new Array(2);
    const loading = true;
    const renderWithSlots = renderWithSimpleContent(DataCard, {
      ...baseOptions,
      props: { ...baseProps, data, loading },
    });

    expect(renderWithSlots.container.firstElementChild).toMatchSnapshot();
  });

  it("should pass the correct function to the button on click event", async () => {
    const onClickMock = vi.fn();
    const headerButtonDetails = {
      action: onClickMock,
      disabled: false,
      label: "Back",
    };
    const { getByRole } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, headerButtonDetails },
    });

    await fireEvent.click(getByRole("button"));

    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it("should render the `DataCard` with a disabled button", () => {
    const headerButtonDetails = {
      action: () => {},
      disabled: true,
      label: "Back",
    };
    const { container, getByRole } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, headerButtonDetails },
    });

    expect(getByRole("button")).toBeDisabled();
    expect(container.firstElementChild).toMatchSnapshot();
  });
});
