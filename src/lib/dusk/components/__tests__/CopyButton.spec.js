import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { CopyButton } from "..";

describe("CopyButton", () => {
  afterEach(cleanup);

  it.each([
    ["Transaction ID", "Copy transaction ID"],
    ["Block hash", "Copy block hash"],
    ["Staking address", "Copy staking address"],
  ])("should name the button for what it copies (%s)", (name, label) => {
    const { getByRole } = render(CopyButton, {
      props: { name, rawValue: "abc" },
    });

    expect(getByRole("button", { name: label })).toBeInTheDocument();
  });

  it("should show its word beside the icon when given one, still named for what it copies", () => {
    const { getByRole } = render(CopyButton, {
      props: { name: "Transaction ID", rawValue: "abc", text: "Copy" },
    });
    const button = getByRole("button", { name: "Copy transaction ID" });

    expect(button).toHaveTextContent(/^Copy$/);
    expect(button).not.toHaveAttribute("data-tooltip-text");
  });

  it("should be the icon alone, with a tooltip, without a word", () => {
    const { getByRole } = render(CopyButton, {
      props: { name: "Block hash", rawValue: "abc" },
    });
    const button = getByRole("button", { name: "Copy block hash" });

    expect(button).toHaveTextContent(/^$/);
    expect(button).toHaveAttribute("data-tooltip-text", "Copy to clipboard");
  });
});
