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
});
