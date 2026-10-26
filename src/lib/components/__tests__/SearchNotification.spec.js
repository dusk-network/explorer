import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { SearchNotification } from "../";

describe("Search Notification", () => {
  const baseProps = {
    data: {
      query: "some query text",
      res: [],
    },
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  const eventHandler = vi.fn();

  afterEach(() => {
    cleanup();
    eventHandler.mockClear();
  });

  it("renders the Search Notification component with the query string", () => {
    const { container } = render(SearchNotification, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("renders the Search Notification component with a Error message", () => {
    const props = {
      ...baseProps,
      data: {
        query: "some query text",
        res: new Error("HTTP Request failed - failed"),
      },
    };
    const { container } = render(SearchNotification, { ...baseOptions, props });

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should offer to search a suggested .dusk name", async () => {
    const onSuggest = vi.fn();
    const { getByRole } = render(SearchNotification, {
      events: { suggest: onSuggest },
      props: {
        data: {
          query: "alice",
          res: new Error("No account, block or transaction matches this."),
          suggestion: "alice.dusk",
        },
      },
    });

    await fireEvent.click(getByRole("button", { name: "Search alice.dusk" }));

    expect(onSuggest).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ detail: "alice.dusk" })
    );
  });

  it("should dispatch a 'close' event when the button is clicked", async () => {
    const { getByRole } = render(SearchNotification, {
      events: { close: eventHandler },
      props: baseProps,
    });

    const button = getByRole("button", { name: "Close" });
    await fireEvent.click(button);
    expect(eventHandler).toHaveBeenCalledOnce();
  });
});
