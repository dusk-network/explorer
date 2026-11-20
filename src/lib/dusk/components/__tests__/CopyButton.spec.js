import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { COPIED_FOR } from "$lib/dusk/motion";

import { CopyButton } from "..";

vi.mock("$lib/dusk/components/toast/store", () => ({ toast: vi.fn() }));

import { toast } from "$lib/dusk/components/toast/store";

/*
 * What lands on the clipboard, and that the button says Copied, in sight
 * and to screen readers, only while it holds the value it shows.
 */
describe("CopyButton", () => {
  const rawValue =
    "8dcf6f8a4b5f0a6e1d2c3b4a59687766554433221100ffeeddccbbaa993db55e";
  const props = { name: "Transaction ID", rawValue, text: "Copy" };

  vi.useFakeTimers();

  /** @param {Error | null} [refusal] */
  const clipboardThat = (refusal = null) => {
    const writeText = refusal
      ? vi.fn().mockRejectedValue(refusal)
      : vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    return writeText;
  };

  afterEach(() => {
    cleanup();
    vi.mocked(toast).mockClear();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should copy the value whole, as it is, and say Copied for a moment", async () => {
    const writeText = clipboardThat();
    const { getByRole } = render(CopyButton, { props });

    expect(getByRole("button")).toHaveTextContent(/^Copy$/);

    await fireEvent.click(getByRole("button"));
    await vi.advanceTimersByTimeAsync(50);

    expect(writeText).toHaveBeenCalledExactlyOnceWith(rawValue);
    expect(getByRole("button")).toHaveTextContent(/^Copied$/);
    expect(getByRole("button")).toHaveAccessibleName("Copied");
    expect(toast).not.toHaveBeenCalled();

    // Then it says Copy again.
    await vi.advanceTimersByTimeAsync(COPIED_FOR);

    expect(getByRole("button")).toHaveTextContent(/^Copy$/);
    expect(getByRole("button")).not.toHaveAccessibleName("Copied");
  });

  it("should say in an error toast that it couldn't copy, and not that it copied", async () => {
    const refusal = new Error("Write failed");

    refusal.name = "NotAllowedError";
    clipboardThat(refusal);

    const { getByRole } = render(CopyButton, { props });

    await fireEvent.click(getByRole("button"));
    await vi.advanceTimersByTimeAsync(50);

    expect(toast).toHaveBeenCalledExactlyOnceWith(
      "error",
      expect.any(String),
      expect.any(String),
    );
    expect(getByRole("button")).toHaveTextContent(/^Copy$/);
    expect(getByRole("button")).not.toHaveAccessibleName("Copied");
  });

  it("should not say Copied for a value it didn't copy", async () => {
    clipboardThat();

    const { getByRole, rerender } = render(CopyButton, { props });

    await fireEvent.click(getByRole("button"));
    await vi.advanceTimersByTimeAsync(50);

    expect(getByRole("button")).toHaveTextContent(/^Copied$/);

    // The page moved on to another transaction within the moment it says so.
    await rerender({ ...props, rawValue: "another hash" });

    expect(getByRole("button")).toHaveTextContent(/^Copy$/);
    expect(getByRole("button")).not.toHaveAccessibleName("Copied");
  });
});
