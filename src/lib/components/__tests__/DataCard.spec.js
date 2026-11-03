import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

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

  it.each(
    /** @type {Array<["page" | "section" | "detail", string, string | undefined, string]>} */ ([
      ["page", "Blocks", undefined, "Loading blocks…"],
      ["section", "Transactions", undefined, "Loading transactions…"],
      ["detail", "Block", undefined, "Loading the block…"],
      [
        "page",
        "Tokens — 0 Displayed Items",
        "Loading tokens…",
        "Loading tokens…",
      ],
    ])
  )(
    "should say what a first load waits for beside a throbber, from the first moment, as a %s titled %s",
    (variant, title, loadingText, words) => {
      const { container, getByText } = render(DataCard, {
        ...baseOptions,
        props: { ...baseProps, loading: true, loadingText, title, variant },
      });

      expect(getByText(words)).toBeInTheDocument();
      expect(container.querySelector(".dusk-throbber")).toBeInTheDocument();
      expect(container.querySelector("[role='progressbar']")).toBeNull();
    }
  );

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
    const { getByRole } = render(DataCard, {
      ...baseOptions,
      props: { ...baseProps, headerButtonDetails },
    });

    expect(getByRole("button")).toBeDisabled();
  });
});
