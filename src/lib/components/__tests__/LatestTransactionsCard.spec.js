import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { gqlTransaction } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";
import { getPrimaryNames } from "$lib/dusk-domains";

import { LatestTransactionsCard } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryNames: vi.fn().mockResolvedValue(new Map()),
}));

describe("LatestTransactionsCard", () => {
  const transfer = transformTransaction(gqlTransaction.tx);
  const sender = /** @type {string} */ (transfer.from);
  const receiver = /** @type {string} */ (transfer.to);
  const txns = [transfer, { ...transfer, txid: "f".repeat(64) }];

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    ["home page", true],
    ["block page", false],
  ])(
    "should look up the names of the accounts it lists in one go on the %s",
    async (_, isOnHomeScreen) => {
      vi.mocked(getPrimaryNames).mockResolvedValueOnce(
        new Map([
          [
            sender,
            { name: "tdi.dusk", url: "https://dusk.domains/name/tdi.dusk" },
          ],
        ])
      );

      const { findAllByRole } = render(LatestTransactionsCard, {
        error: null,
        isOnHomeScreen,
        isSmallScreen: false,
        loading: false,
        txns,
      });

      expect(getPrimaryNames).toHaveBeenCalledExactlyOnceWith([
        sender,
        receiver,
      ]);

      const names = await findAllByRole("link", { name: "tdi.dusk" });

      expect(names).toHaveLength(2);
      expect(names[0]).toHaveAttribute(
        "href",
        `/some-base-path/accounts/?key=${sender}`
      );
      expect(names[0]).toHaveAttribute(
        "data-tooltip-text",
        `tdi.dusk · ${sender.slice(0, 6)}...${sender.slice(-6)}`
      );
    }
  );

  it("should look up nothing for a list without public accounts", () => {
    render(LatestTransactionsCard, {
      error: null,
      isSmallScreen: false,
      loading: false,
      txns: [
        { ...transfer, from: undefined, to: undefined, txtype: "Phoenix" },
      ],
    });

    expect(getPrimaryNames).toHaveBeenCalledExactlyOnceWith([]);
  });
});
