import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { TransactionStatus } from "..";

describe("TransactionStatus", () => {
  const baseProps = {
    errorMessage: "",
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  it("should say Completed or Failed, as the wallets do", () => {
    const { container, rerender } = render(TransactionStatus, baseOptions);

    expect(container.firstElementChild).toHaveTextContent(/^Completed$/);

    rerender({ errorMessage: "Panic" });

    return vi.waitFor(() =>
      expect(container.firstElementChild).toHaveTextContent(/^Failed$/)
    );
  });

  it("should say why it failed in a tooltip when asked to, and only then", () => {
    const tooltipOf = (/** @type {Record<string, unknown>} */ props) => {
      cleanup();

      return render(TransactionStatus, {
        ...baseOptions,
        props: { ...baseProps, ...props },
      }).container.firstElementChild?.getAttribute("data-tooltip-text");
    };

    expect(tooltipOf({ errorMessage: "Panic", showErrorTooltip: true })).toBe(
      "Panic"
    );
    expect(tooltipOf({ errorMessage: "Panic" })).toBeNull();
    expect(tooltipOf({ showErrorTooltip: true })).toBeNull();
  });
});
