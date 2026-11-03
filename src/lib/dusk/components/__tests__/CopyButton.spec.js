import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { mdiCheck, mdiContentCopy } from "@mdi/js";

import { CopyButton } from "..";

vi.mock("$lib/dusk/components/toast/store", () => ({ toast: vi.fn() }));

import { toast } from "$lib/dusk/components/toast/store";

describe("CopyButton", () => {
  const rawValue =
    "8dcf6f8a4b5f0a6e1d2c3b4a59687766554433221100ffeeddccbbaa993db55e";

  vi.useFakeTimers();

  /** @param {Error | null} [refusal] */
  const clipboardThat = (refusal = null) => {
    Object.assign(navigator, {
      clipboard: {
        writeText: refusal
          ? vi.fn().mockRejectedValue(refusal)
          : vi.fn().mockResolvedValue(undefined),
      },
    });
  };

  /** What screen readers hear, from the app's polite live region. */
  const heard = () =>
    document.querySelector("[aria-live='polite']")?.textContent ?? "";

  /** @param {HTMLElement} button */
  const iconOf = (button) => button.querySelector("path")?.getAttribute("d");

  afterEach(() => {
    cleanup();
    vi.mocked(toast).mockClear();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

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

  it("should say Copied on the button for 1.5 s, where it was pressed, and in no toast", async () => {
    clipboardThat();

    const { getByRole } = render(CopyButton, {
      props: { name: "Transaction ID", rawValue, text: "Copy" },
    });
    const button = getByRole("button", { name: "Copy transaction ID" });

    expect(heard()).toBe("");

    await fireEvent.click(button);
    await vi.advanceTimersByTimeAsync(50);

    expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(
      rawValue
    );
    expect(button).toHaveAccessibleName("Copied");
    expect(button).toHaveTextContent(/^Copied$/);
    expect(iconOf(button)).toBe(mdiCheck);
    expect(heard()).toBe("Copied");
    expect(toast).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1449);

    expect(button).toHaveAccessibleName("Copied");

    await vi.advanceTimersByTimeAsync(51);

    expect(button).toHaveAccessibleName("Copy transaction ID");
    expect(button).toHaveTextContent(/^Copy$/);
    expect(iconOf(button)).toBe(mdiContentCopy);
    expect(heard()).toBe("");
  });

  it("should name an icon alone Copied, once it copied, its tooltip as it was", async () => {
    clipboardThat();

    const { getByRole } = render(CopyButton, {
      props: { name: "Block hash", rawValue },
    });
    const button = getByRole("button", { name: "Copy block hash" });

    await fireEvent.click(button);
    await vi.advanceTimersByTimeAsync(50);

    expect(button).toHaveAccessibleName("Copied");
    expect(iconOf(button)).toBe(mdiCheck);
    expect(button).toHaveAttribute("data-tooltip-text", "Copy to clipboard");
    expect(heard()).toBe("Copied");

    await vi.advanceTimersByTimeAsync(1500);
  });

  it("should say in a toast it couldn't copy, and not that it copied", async () => {
    const refusal = new Error("Write failed");

    refusal.name = "NotAllowedError";
    clipboardThat(refusal);

    const { getByRole } = render(CopyButton, {
      props: { name: "Transaction ID", rawValue, text: "Copy" },
    });
    const button = getByRole("button", { name: "Copy transaction ID" });

    await fireEvent.click(button);
    await vi.advanceTimersByTimeAsync(50);

    expect(toast).toHaveBeenCalledExactlyOnceWith(
      "error",
      "Clipboard access denied",
      expect.any(String)
    );
    expect(button).toHaveAccessibleName("Copy transaction ID");
    expect(heard()).toBe("");
  });
});
