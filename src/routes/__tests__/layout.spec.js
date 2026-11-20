import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { apiNodeInfo } from "$lib/mock-data";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

import MainLayout from "../+layout.svelte";

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
 * Every page of a test network warns, at its top, that its DUSK has no
 * value.
 */
describe("Main layout", () => {
  const getNodeInfo = vi.spyOn(duskAPI, "getNodeInfo");

  afterEach(() => {
    cleanup();
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  afterAll(() => {
    getNodeInfo.mockRestore();
    vi.unstubAllGlobals();
  });

  /** @param {number} chainId The network the node says it is on */
  const renderOn = async (chainId) => {
    getNodeInfo.mockResolvedValue({ ...apiNodeInfo, chain_id: chainId });

    const rendered = render(MainLayout);

    await vi.waitFor(() =>
      expect(get(appStore).nodeInfo.chain_id).toBe(chainId),
    );

    return rendered;
  };

  it("should warn at the top of a test network's pages that test DUSK has no value, and not on mainnet", async () => {
    // Testnet, a devnet and a local node.
    for (const chainId of [2, 3, 0]) {
      const { container, getByRole } = await renderOn(chainId);
      const note = getByRole("note");

      expect(note).toHaveTextContent(/no value/i);
      expect(container.querySelector("header")?.contains(note)).toBe(true);
      cleanup();
    }

    const { queryByRole } = await renderOn(1);

    expect(queryByRole("note")).toBeNull();
  });
});
