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

  it("renders the Footer component", () => {
    const { container } = render(Footer);

    expect(container.firstElementChild).toMatchSnapshot();
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
      ["Mainnet", "https://apps.dusk.network/explorer"],
      ["Devnet", "https://apps.devnet.dusk.network/explorer"],
      ["Privacy policy", "https://dusk.network/privacy-policy"],
      ["Terms of use", "https://dusk.network/terms-of-use"],
    ]);

    await act(() =>
      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined })
    );
  });
});
