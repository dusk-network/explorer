import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";

import { getStakedDusk } from "$lib/contracts";
import { apiNodeInfo } from "$lib/mock-data";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

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

vi.mock("$lib/contracts", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getStakedDusk: vi.fn().mockResolvedValue(null),
}));

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
      accountHistory: vi.fn(() => ({
        next: vi.fn().mockResolvedValue({ done: true, transactions: [] }),
      })),
      getAccountStatus: vi
        .fn()
        .mockResolvedValue({ balance: 1_484_920_000_000, nonce: 15 }),
      getChainTip: vi.fn().mockResolvedValue({
        date: new Date(Date.UTC(2026, 9, 26, 10, 0, 0)),
        hash: "",
        height: 123_000,
        transactions: 0,
      }),
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

/**
 * The amounts the page gives, in order: the public balance, the stake and
 * its rewards.
 *
 * @param {HTMLElement} container
 */
const amountsOf = (container) =>
  Array.from(container.querySelectorAll(".dusk-amount"), (amount) =>
    amount.textContent?.trim(),
  );

/*
 * The figures the page gives an account, from which reads: its words are
 * copy.
 */
describe("Account page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    pages.open(key);
  });

  afterAll(() => {
    vi.doUnmock("$app/stores");
    vi.doUnmock("$lib/contracts");
    vi.doUnmock("$lib/dusk-domains");
    vi.doUnmock("$lib/services");
  });

  it("should show the public balance, the stake and its rewards from one stake read", async () => {
    const { container } = render(AccountPage);

    await vi.waitFor(() =>
      expect(amountsOf(container)).toStrictEqual([
        "1,484.92 DUSK",
        "1,000 DUSK",
        "31.0271 DUSK",
      ]),
    );

    expect(duskAPI.getStake).toHaveBeenCalledExactlyOnceWith(key);
    expect(duskAPI.getAccountStatus).toHaveBeenCalledExactlyOnceWith(key);
  });

  it("should give no stake figures when the stake can't be read, and leave the balance", async () => {
    vi.mocked(duskAPI.getStake).mockRejectedValueOnce(new Error("offline"));

    const { container } = render(AccountPage);

    await vi.waitFor(() => expect(duskAPI.getStake).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(amountsOf(container)).toStrictEqual(["1,484.92 DUSK"]),
    );
    expect(container.textContent).not.toMatch(/\b0 DUSK/);
  });

  it("should say what the account also staked with Sozu, from one read made once the node says its network", async () => {
    vi.mocked(getStakedDusk).mockResolvedValue(162_189_471n);

    const { container } = render(AccountPage);

    // No network yet: nothing to read it from.
    await vi.waitFor(() => expect(amountsOf(container)).toHaveLength(3));
    expect(getStakedDusk).not.toHaveBeenCalled();

    await act(() => appStore.setNodeInfo(apiNodeInfo));

    await vi.waitFor(() =>
      expect(container).toHaveTextContent("0.1621 stDUSK"),
    );
    expect(getStakedDusk).toHaveBeenCalledExactlyOnceWith(key, 2);

    vi.mocked(getStakedDusk).mockResolvedValue(null);
    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
  });

  it("should leave out the Sozu line when the stDUSK can't be read", async () => {
    vi.mocked(getStakedDusk).mockRejectedValueOnce(new Error("offline"));
    appStore.setNodeInfo(apiNodeInfo);

    const { container } = render(AccountPage);

    await vi.waitFor(() => expect(getStakedDusk).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(amountsOf(container)).toHaveLength(3));
    expect(container.textContent).not.toContain("stDUSK");

    appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined });
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
      const rewards = () => amountsOf(container)[2];

      await act(() => pages.open(other));
      await act(() => pages.open(key));
      await vi.waitFor(() => expect(rewards()).toBe("2 DUSK"));

      settleLate(late);
      await new Promise((resolve) => setTimeout(resolve));

      expect(rewards()).toBe("2 DUSK");
      expect(duskAPI.getStake).toHaveBeenCalledTimes(3);
    },
  );

  it("should ask the node nothing about an address that isn't an account's", async () => {
    pages.open("notanaccount");

    const { container } = render(AccountPage);

    expect(amountsOf(container)).toStrictEqual([]);
    expect(duskAPI.getAccountStatus).not.toHaveBeenCalled();
    expect(duskAPI.getStake).not.toHaveBeenCalled();
    expect(duskAPI.accountHistory).not.toHaveBeenCalled();

    await act(() => appStore.setNodeInfo(apiNodeInfo));

    expect(getStakedDusk).not.toHaveBeenCalled();
  });
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
