import { afterEach, describe, expect, it, vi } from "vitest";
import { mdiMagnify } from "@mdi/js";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { TextboxAndButton } from "..";

describe("TextField", () => {
  afterEach(cleanup);

  /** @type {import("svelte").ComponentProps<TextboxAndButton>} */
  const baseProps = {
    className: "foo bar",
    icon: {
      path: mdiMagnify,
      position: "after",
      size: "default",
    },
    placeholder: "Search",
  };

  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  it("renders the component with default values", async () => {
    const { getByRole, container } = render(TextboxAndButton, baseOptions);

    const input = getByRole("textbox");
    const button = getByRole("button");

    expect(input).toBeInTheDocument();
    expect(button).toBeInTheDocument();

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("updates input value on change", async () => {
    const { getByRole, container } = render(TextboxAndButton, baseOptions);
    const input = getByRole("textbox");

    await fireEvent.input(input, { target: { value: "test value" } });

    expect(input).toHaveValue("test value");

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("triggers click event on button click", async () => {
    const mockClickHandler = vi.fn();
    const { getByRole } = render(TextboxAndButton, {
      events: { click: mockClickHandler },
      props: baseProps,
    });
    const button = getByRole("button");

    await fireEvent.click(button);

    expect(mockClickHandler).toHaveBeenCalledOnce();
  });

  it("focuses input on focus() call", async () => {
    const { getByRole, component } = render(TextboxAndButton);
    const input = getByRole("textbox");

    component.focus();
    expect(input).toHaveFocus();
  });

  it("should expose a method to select the element's text", () => {
    const { component, getByRole } = render(TextboxAndButton, {
      ...baseProps,
      value: "some input text",
    });

    const input = /** @type {HTMLInputElement} */ (getByRole("textbox"));

    component.select();

    const selectedText = input.value.substring(
      Number(input.selectionStart),
      Number(input.selectionEnd)
    );

    expect(selectedText).toBe("some input text");
  });
});
