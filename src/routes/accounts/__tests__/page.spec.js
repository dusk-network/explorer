import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";

import { duskAPI } from "$lib/services";

import AccountPage from "../+page.svelte";

const { key, pages } = vi.hoisted(() => ({
  key: "qxwSidLBa1rJ74ngfP4GUCaNsAYjMboDPHzbmiVEMmNNK26hVkYe8QccH6ipYdVRsUDnx9QS1KBeu8ZoMDFpXJJE6YCcHy2AykvJ7eEAGc7PGDgCZFV5YJBxzukADkQ2Bgr",
  /** @type {{ open: (account: string) => void }} */
  pages: { open: () => {} },
}));

vi.mock("$app/stores", async (importOriginal) => {
  const { writable } = await import("svelte/store");
  /** @param {string} account */
  const at = (account) => ({
    url: new URL(`http://localhost/accounts/?key=${account}`),
  });
  const page = writable(at(key));

  pages.open = (account) => page.set(at(account));

  return {
    .../** @type {object} */ (await importOriginal()),
    page: { subscribe: page.subscribe },
  };
});

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
  getSearchedName: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/services", async (importOriginal) => {
  /** @type {import("$lib/services")} */
  const original = await importOriginal();

  return {
    ...original,
    duskAPI: {
      ...original.duskAPI,
      getAccountStatus: vi
        .fn()
        .mockResolvedValue({ balance: 1_484_920_000_000, nonce: 15 }),
      getChainTip: vi.fn().mockResolvedValue({
        date: new Date(Date.UTC(2026, 9, 26, 10, 0, 0)),
        height: 123_000,
      }),
      getMoonlightAccountTransactions: vi.fn().mockResolvedValue([]),
      getStake: vi.fn().mockResolvedValue({
        active: 1_000_000_000_000n,
        eligibility: 123_120,
        faults: 1,
        hardFaults: 0,
        inactive: 0n,
        reward: 31_027_186_000n,
      }),
    },
  };
});

describe("Account page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    pages.open(key);
  });

  afterAll(() => {
    vi.doUnmock("$app/stores");
    vi.doUnmock("$lib/dusk-domains");
    vi.doUnmock("$lib/services");
  });

  it("should show the public balance, the stake and its rewards from one stake read", async () => {
    const { container, getByText } = render(AccountPage);

    await vi.waitFor(() =>
      expect(container.textContent).toContain("Stake rewards")
    );
    await vi.waitFor(() =>
      expect(
        Array.from(container.querySelectorAll(".dusk-amount"), (amount) =>
          amount.textContent?.trim()
        )
      ).toStrictEqual(["1,484.92 DUSK", "1,000 DUSK", "31.0271 DUSK"])
    );

    expect(duskAPI.getStake).toHaveBeenCalledExactlyOnceWith(key);
    expect(duskAPI.getAccountStatus).toHaveBeenCalledExactlyOnceWith(key);
    expect(getByText("Public balance")).toBeInTheDocument();
    // The stake's block, 120 blocks after the last one, comes in about
    // 20 minutes.
    await vi.waitFor(() =>
      expect(
        container
          .querySelector(".account-overview-panel__stake")
          ?.textContent?.replace(/\s+/g, " ")
          .trim()
      ).toBe(
        "Active 1,000 DUSK · Inactive 0 DUSK · Eligible from about Mon 26 Oct 2026, 10:20 UTC · Slashes: 1 soft, 0 hard"
      )
    );
    expect(getByText(/Eligible from about/)).toHaveAttribute(
      "title",
      "Block 123,120"
    );
    expect(duskAPI.getChainTip).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector(".account-overview-panel__header")
    ).toHaveTextContent(/^Provisioner:/);
    expect(container.textContent).toContain("Shielded funds aren't shown.");
  });

  it("should say N/A when the stake can't be read, and leave the rest", async () => {
    vi.mocked(duskAPI.getStake).mockRejectedValueOnce(new Error("offline"));

    const { container } = render(AccountPage);

    await vi.waitFor(() =>
      expect(
        Array.from(
          container.querySelectorAll(".overview-panel__details-item"),
          (item) => item.textContent?.replace(/\s+/g, " ").trim()
        )
      ).toStrictEqual([
        "1,484.92 DUSK Public balance",
        "N/A Stake",
        "N/A Stake rewards",
      ])
    );
    expect(duskAPI.getStake).toHaveBeenCalledTimes(1);
  });

  it("should say since when a stake has taken part, and give the block on hover", async () => {
    vi.mocked(duskAPI.getChainTip).mockResolvedValueOnce({
      date: new Date(Date.UTC(2026, 9, 26, 10, 0, 0)),
      height: 123_120 + 8640,
    });

    const { findByText } = render(AccountPage);

    expect(
      await findByText(/Eligible since about Sun 25 Oct 2026, 10:00 UTC/)
    ).toHaveAttribute("title", "Block 123,120");
  });

  it("should call an account without a stake an account, and read no block for it", async () => {
    vi.mocked(duskAPI.getStake).mockResolvedValueOnce(null);

    const { container } = render(AccountPage);

    await vi.waitFor(() =>
      expect(container.querySelectorAll(".dusk-amount")).toHaveLength(3)
    );

    expect(
      container.querySelector(".account-overview-panel__header")
    ).toHaveTextContent(/^Account:/);
    expect(
      container.querySelector(".account-overview-panel__stake")
    ).toBeNull();
    expect(duskAPI.getChainTip).not.toHaveBeenCalled();
  });

  it.each([
    ["answer", (/** @type {any} */ late) => late.resolve(stakeOf(1n))],
    ["failure", (/** @type {any} */ late) => late.reject(new Error("late"))],
  ])(
    "should drop a stake read's late %s once the page has moved on, even back to the same account",
    async (_, settleLate) => {
      const other =
        "n3qToJrMkYCnUkJkFG2a7fEVn2Krj6arVUfuQbZNRk4gcDPQ9jESngvKQGZ4XToGAhS4qFsGzJtiZzDJ5E9TyYA5SZcCJGYfi5cZWBJkzmAmwiScS256TCMZZjmEq6aNuj6";
      const late = Promise.withResolvers();

      vi.mocked(duskAPI.getStake)
        .mockReturnValueOnce(/** @type {any} */ (late.promise))
        .mockResolvedValueOnce(stakeOf(5n))
        .mockResolvedValueOnce(stakeOf(2n));

      const { container } = render(AccountPage);
      const rewards = () =>
        container.querySelectorAll(".dusk-amount")[2]?.textContent?.trim();

      await act(() => pages.open(other));
      await act(() => pages.open(key));
      await vi.waitFor(() => expect(rewards()).toBe("2 DUSK"));

      settleLate(late);
      await new Promise((resolve) => setTimeout(resolve));

      expect(rewards()).toBe("2 DUSK");
      expect(duskAPI.getStake).toHaveBeenCalledTimes(3);
    }
  );
});

/**
 * A stake with only rewards, in whole DUSK.
 *
 * @param {bigint} dusk
 */
function stakeOf(dusk) {
  return {
    active: 0n,
    eligibility: 0,
    faults: 0,
    hardFaults: 0,
    inactive: 0n,
    reward: dusk * 1_000_000_000n,
  };
}
