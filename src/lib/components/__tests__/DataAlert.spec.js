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

  it("should say what an empty list means, as its card tells it", () => {
    const { container } = render(DataAlert, {
      props: { emptyText: "No transactions in this block.", error: null },
    });

    expect(container.firstElementChild).toHaveTextContent(
      /^No transactions in this block\.$/
    );
  });

  it("should say a load failed, give its error, and offer to try again", () => {
    const { container, getByRole } = render(DataAlert, {
      props: { error: new Error("Request timed out") },
    });

    expect(container.firstElementChild).toHaveTextContent(
      /^Couldn't load this\.\s*Request timed out\s*Try again$/
    );
    expect(getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
