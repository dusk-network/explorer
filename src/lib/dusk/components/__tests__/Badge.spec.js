import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { Badge } from "..";

describe("Badge", () => {
  const baseProps = {
    text: "Badge",
  };

  afterEach(cleanup);

  it("should only display a string 10 characters long", () => {
    const props = {
      ...baseProps,
      maxlength: 10,
      text: "ABCDEFGHIJK",
    };
    const { container } = render(Badge, { ...props });
    expect(container.firstElementChild?.textContent?.length).toBe(10);
  });
});
