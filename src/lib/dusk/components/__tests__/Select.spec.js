import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";

import { Select } from "../";

const stringOptions = ["one", "two", "three", "four"];

describe("Select", () => {
  const baseProps = {
    options: stringOptions,
  };
  afterEach(cleanup);

  it("should accept a change event handler", async () => {
    const changeHandler = vi.fn();
    const props = {
      ...baseProps,
      "data-testid": "my-select",
      value: "two",
    };
    render(Select, {
      events: { change: changeHandler },
      props,
    });

    /** @type {HTMLSelectElement} */
    const select = screen.getByTestId("my-select");
    const target = select.querySelector("option[value='four']");

    await fireEvent.change(select, { target });

    expect(changeHandler).toHaveBeenCalledTimes(1);
    expect(changeHandler).toHaveBeenCalledWith(expect.any(Event));
    expect(select.value).toBe("four");
  });
});
