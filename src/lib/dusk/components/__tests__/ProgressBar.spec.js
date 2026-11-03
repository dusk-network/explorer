import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { ProgressBar } from "..";

describe("ProgressBar", () => {
  const baseProps = {
    ariaLabel: "Loading",
    currentPercentage: 0,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  it("renders the `ProgressBar` component with no current percentage set", () => {
    const { container } = render(ProgressBar, {
      ...baseOptions,
      props: { ariaLabel: baseProps.ariaLabel },
    });

    expect(container.firstElementChild).toBeInTheDocument();
  });
});
