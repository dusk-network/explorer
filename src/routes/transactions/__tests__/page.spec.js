import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import { duskAPI } from "$lib/services";
import { transformTransaction } from "$lib/chain-info";
import { appStore, chainHeadStore } from "$lib/stores";
import { gqlTransactions } from "$lib/mock-data";
import { changeMediaQueryMatches } from "$lib/dusk/test-helpers";

import Transactions from "../+page.svelte";

// The chain's newest block, as the test gives it.
vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {import("$lib/stores")} */
  const original = await importOriginal();
  const { writable } = await import("svelte/store");

  return {
    ...original,
    chainHeadStore: writable({ error: null, head: null }),
  };
});

/** @type {import("svelte/store").Writable<{ error: Error | null, head: any }>} */
const head = /** @type {any} */ (chainHeadStore);

/** @param {number} height */
const newBlock = (height) =>
  head.set({
    error: null,
    head: {
      at: Date.now(),
      date: new Date(),
      hash: `h${height}`,
      height,
      transactions: 0,
    },
  });

describe("Transactions page", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 4, 30));

  const { fetchInterval, transactionsListEntries } = get(appStore);
  const tip = {
    date: new Date(),
    hash: "tip-hash",
    height: 7000,
    transactions: 0,
  };
  const getChainTipSpy = vi
    .spyOn(duskAPI, "getChainTip")
    .mockResolvedValue(tip);
  const getTransactionSpy = vi
    .spyOn(duskAPI, "getTransactions")
    .mockResolvedValue(gqlTransactions.transactions.map(transformTransaction));

  // The node has no block after the last one.
  const getTransactionsAfterSpy = vi
    .spyOn(duskAPI, "getTransactionsAfter")
    .mockResolvedValue({ anchor: tip.hash, blocks: [], transactions: [] });

  afterEach(() => {
    cleanup();
    getChainTipSpy.mockClear();
    getTransactionSpy
      .mockClear()
      .mockResolvedValue(
        gqlTransactions.transactions.map(transformTransaction)
      );
    getTransactionsAfterSpy.mockClear();
  });

  afterAll(() => {
    vi.useRealTimers();
    getChainTipSpy.mockRestore();
    getTransactionSpy.mockRestore();
    getTransactionsAfterSpy.mockRestore();
    vi.doUnmock("$lib/stores");
  });

  it("should render the Transactions page, read the new transactions at each new block and only then, and stop when unmounted", async () => {
    const { container, unmount } = render(Transactions);

    // snapshost in loading state
    expect(container.firstElementChild).toMatchSnapshot();
    expect(getChainTipSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(getTransactionSpy).toHaveBeenCalledTimes(1);
    expect(getTransactionSpy).toHaveBeenNthCalledWith(
      1,
      transactionsListEntries
    );

    // snapshot with received data from GraphQL
    expect(container.firstElementChild).toMatchSnapshot();

    // No new block: nothing more is read.
    await vi.advanceTimersByTimeAsync(fetchInterval * 3);
    expect(getTransactionsAfterSpy).not.toHaveBeenCalled();

    newBlock(tip.height + 1);
    await vi.advanceTimersByTimeAsync(1);

    expect(getTransactionsAfterSpy).toHaveBeenCalledTimes(1);
    expect(getTransactionsAfterSpy).toHaveBeenNthCalledWith(
      1,
      tip.height,
      tip.height + 199
    );

    newBlock(tip.height + 2);
    await vi.advanceTimersByTimeAsync(1);

    expect(getTransactionsAfterSpy).toHaveBeenCalledTimes(2);
    expect(getTransactionSpy).toHaveBeenCalledTimes(1);
    expect(getChainTipSpy).toHaveBeenCalledTimes(1);

    unmount();

    newBlock(tip.height + 3);
    await vi.advanceTimersByTimeAsync(fetchInterval * 10);

    expect(getTransactionsAfterSpy).toHaveBeenCalledTimes(2);
    expect(getTransactionSpy).toHaveBeenCalledTimes(1);
  });

  it("should render the Transactions page with the mobile layout", async () => {
    const { container } = render(Transactions);

    changeMediaQueryMatches("(max-width: 1024px)", true);

    expect(get(appStore).isSmallScreen).toBe(true);

    await vi.advanceTimersByTimeAsync(1);

    expect(getTransactionSpy).toHaveBeenCalledTimes(1);
    expect(getTransactionSpy).toHaveBeenNthCalledWith(
      1,
      transactionsListEntries
    );

    expect(container.firstElementChild).toMatchSnapshot();
  });
});
