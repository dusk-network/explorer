import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";

import { apiNodeInfo } from "$lib/mock-data";
import { appStore } from "$lib/stores";

import { Footer } from "../";

describe("Footer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should link the other networks' explorers and Dusk's terms, as @dusk-network/networks gives them", async () => {
    const { getAllByRole } = render(Footer);
    const links = () =>
      getAllByRole("link").map((link) => [
        link.textContent?.trim(),
        link.getAttribute("href"),
      ]);

    // On testnet: the explorers of mainnet and devnet.
    await act(() => appStore.setNodeInfo(apiNodeInfo));

    expect(links().slice(0, 4)).toStrictEqual([
      ["Mainnet", "https://explorer.dusk.network"],
      ["Devnet", "https://explorer.devnet.dusk.network"],
      ["Privacy", "https://dusk.network/privacy-policy"],
      ["Terms", "https://dusk.network/terms-of-use"],
    ]);

    await act(() =>
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined }),
    );
  });

  it("should give the copyright as it is, and the version with its build's commit and date", () => {
    const { container } = render(Footer);
    const lines = Array.from(
      container.querySelectorAll(".footer__copyright-container p"),
      (line) => line.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(lines).toStrictEqual([
      "© 2018 - 2025 Dusk Network B.V. All Rights Reserved.",
      "v0.0.0 (hash1234 2024-01-12)",
    ]);
  });
});
