import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { SearchNotification } from "../";

describe("Search Notification", () => {
  const baseProps = {
    data: {
      query: "some query text",
      res: new Error("HTTP Request failed - failed"),
    },
  };
  const eventHandler = vi.fn();

  afterEach(() => {
    cleanup();
    eventHandler.mockClear();
  });

  it("should offer to search a suggested .dusk name", async () => {
    const onSuggest = vi.fn();
    const { getByRole } = render(SearchNotification, {
      events: { suggest: onSuggest },
      props: {
        data: {
          query: "alice",
          res: new Error(""),
          suggestion: "alice.dusk",
        },
      },
    });

    await fireEvent.click(getByRole("button", { name: "Search alice.dusk" }));

    expect(onSuggest).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ detail: "alice.dusk" }),
    );
  });

  it("should give a whole ID or address short, as every Dusk app shortens one, and anything else as typed", () => {
    /** @param {string} query */
    const shown = (query) => {
      cleanup();

      return render(SearchNotification, {
        props: { data: { query, res: new Error("") } },
      }).container.querySelector(".search-notification__content-query")
        ?.textContent;
    };

    expect(shown("ab".repeat(32))).toBe("ababab…ababab");
    expect(shown("e5f314fb49a8a2f8")).toBe("e5f314fb49a8a2f8");
    expect(shown("dc3f73…1c204a")).toBe("dc3f73…1c204a");
    expect(shown("alice.dusk")).toBe("alice.dusk");
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
