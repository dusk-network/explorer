import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";

import { apiNodeInfo } from "$lib/mock-data";
import { appStore } from "$lib/stores";

import { TestnetStrip } from "..";

/*
 * On a test network the explorer warns that its DUSK has no value.
 */
describe("TestnetStrip", () => {
  afterEach(() => {
    cleanup();
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  it("should warn on a test network that test DUSK has no value, and not on mainnet", async () => {
    const { queryByRole } = render(TestnetStrip);

    // Before the node says which network it is on.
    expect(queryByRole("note")).toBeNull();

    for (const chainId of [2, 3, 0]) {
      await act(() =>
        appStore.setNodeInfo({ ...apiNodeInfo, chain_id: chainId }),
      );

      expect(queryByRole("note")).toHaveTextContent(/no value/i);
    }

    await act(() => appStore.setNodeInfo({ ...apiNodeInfo, chain_id: 1 }));

    expect(queryByRole("note")).toBeNull();
  });
});
