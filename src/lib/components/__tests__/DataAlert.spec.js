import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { DataAlert } from "..";

describe("DataAlert", () => {
  const baseProps = {
    error: null,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  it("should render the `DataAlert` in the no data state", () => {
    const { container } = render(DataAlert, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should render the `DataAlert` in the error state", () => {
    const error = new Error("error");
    const { container } = render(DataAlert, {
      ...baseOptions,
      props: { ...baseProps, error },
    });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should dispatch the `retry` event on button click", async () => {
    const eventHandler = vi.fn();
    const error = new Error("error");
    const { getByRole } = render(DataAlert, {
      events: { retry: eventHandler },
      props: { ...baseProps, error },
    });

    await fireEvent.click(getByRole("button"));
    expect(eventHandler).toHaveBeenCalledTimes(1);
  });
});
