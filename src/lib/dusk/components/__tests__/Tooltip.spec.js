import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { Tooltip } from "..";

// The tooltip watches what it points at, which jsdom can't.
vi.stubGlobal(
  "IntersectionObserver",
  class {
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  },
);

/*
 * What screen readers hear: the tooltip's words describe what it points at
 * while it shows, and a description of its own stays.
 */
describe("Tooltip", () => {
  /**
   * A control the tooltip is about, in the page.
   *
   * @param {Record<string, string>} [attributes]
   */
  const target = (attributes = {}) => {
    const button = document.createElement("button");

    button.textContent = "Fee";
    button.dataset.tooltipId = "main-tooltip";
    button.dataset.tooltipText = "The DUSK the network took";
    Object.entries(attributes).forEach(([name, value]) =>
      button.setAttribute(name, value),
    );
    document.body.append(button);

    return button;
  };

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("should describe what it points at while it shows, and no longer after", async () => {
    render(Tooltip, { props: { defaultDelayShow: 0, id: "main-tooltip" } });

    const fee = target();

    await fireEvent.mouseEnter(fee);
    await vi.waitFor(() =>
      expect(fee).toHaveAccessibleDescription("The DUSK the network took"),
    );

    await fireEvent.mouseLeave(fee);

    expect(fee).not.toHaveAccessibleDescription();
  });

  it("should leave a description of the target's own as it is", async () => {
    render(Tooltip, { props: { defaultDelayShow: 0, id: "main-tooltip" } });

    const own = document.createElement("span");

    own.id = "fee-help";
    own.textContent = "The DUSK the network took";
    document.body.append(own);

    const help = target({ "aria-describedby": "fee-help" });

    await fireEvent.focusIn(help);
    await vi.waitFor(() =>
      expect(document.querySelector("#main-tooltip")).toHaveAttribute(
        "aria-hidden",
        "false",
      ),
    );

    expect(help).toHaveAccessibleDescription("The DUSK the network took");

    await fireEvent.focusOut(help);

    expect(help).toHaveAttribute("aria-describedby", "fee-help");
    expect(help).toHaveAccessibleDescription("The DUSK the network took");
  });
});
