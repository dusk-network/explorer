import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";

import { hostProvisioners } from "$lib/mock-data";
import { getPrimaryName, getSearchedName } from "$lib/dusk-domains";

import { AccountOverview } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
  getSearchedName: vi.fn().mockResolvedValue(null),
}));

describe("AccountOverview", () => {
  const accountAddress = hostProvisioners[0].key;
  const baseProps = {
    accountAddress,
    accountBalance: 1_000_000_000,
    errorFetchingAccountStatus: false,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should lead with the searched name, then the account's primary name", async () => {
    vi.mocked(getSearchedName).mockResolvedValueOnce({
      name: "domains.dusk",
      url: "https://dusk.domains/name/domains.dusk",
    });
    vi.mocked(getPrimaryName).mockResolvedValue({
      name: "duskdomains.dusk",
      url: "https://dusk.domains/name/duskdomains.dusk",
    });

    const { container, getByRole } = render(AccountOverview, {
      ...baseProps,
      searchedName: "Domains.dusk",
    });
    const header = /** @type {HTMLElement} */ (
      container.querySelector(".account-overview-panel__header")
    );

    await vi.waitFor(() =>
      expect(
        container.querySelector(".account-overview-panel__searched-name")
          ?.textContent
      ).toMatch(/^\s*Primary name:\s+duskdomains\.dusk/)
    );
    const kind = /** @type {Element} */ (
      container.querySelector(".account-overview-panel__kind")
    );

    // As a transaction's page: [ ACCOUNT ], its brackets drawn, not read.
    expect(kind).toHaveTextContent(/^\[Account\]$/);
    expect(
      Array.from(kind.children, (bracket) => [
        bracket.textContent,
        bracket.getAttribute("aria-hidden"),
      ])
    ).toStrictEqual([
      ["[", "true"],
      ["]", "true"],
    ]);
    expect(header.textContent).toMatch(/^\s*domains\.dusk/);
    expect(header.textContent).not.toContain("duskdomains.dusk");
    expect(
      getByRole("link", { name: "Open domains.dusk on Dusk Domains" })
    ).toHaveAttribute("href", "https://dusk.domains/name/domains.dusk");
    expect(
      getByRole("link", { name: "Open duskdomains.dusk on Dusk Domains" })
    ).toHaveAttribute("href", "https://dusk.domains/name/duskdomains.dusk");
    expect(getSearchedName).toHaveBeenCalledWith(
      "Domains.dusk",
      accountAddress
    );

    vi.mocked(getPrimaryName).mockResolvedValue(null);
  });

  it("should show no searched name when there is none to show", async () => {
    const { container } = render(AccountOverview, baseProps);

    await vi.waitFor(() => expect(getPrimaryName).toHaveBeenCalled());
    expect(getSearchedName).toHaveBeenCalledWith(null, accountAddress);
    // Let the lookup settle before checking that nothing shows.
    await vi.mocked(getSearchedName).mock.results[0].value;
    await tick();
    expect(
      container.querySelector(".account-overview-panel__searched-name")
    ).toBeNull();
  });

  /** @param {HTMLElement} container */
  const cardsOf = (container) =>
    Array.from(
      container.querySelectorAll(".overview-panel__details-item"),
      (card) => card.textContent?.replace(/\s+/g, " ").trim()
    );

  it("should call the stake the native stake, so that none doesn't read as nothing staked", () => {
    const { container } = render(AccountOverview, {
      ...baseProps,
      stake: null,
    });

    expect(cardsOf(container)).toStrictEqual([
      "Public balance 1 DUSK",
      "Native stake 0 DUSK",
      "Stake rewards 0 DUSK",
    ]);
  });

  it("should say what the account also staked with Sozu, in stDUSK, only when it holds some", async () => {
    const { container, rerender } = render(AccountOverview, {
      ...baseProps,
      stake: null,
      stakedDusk: 162_189_471n,
    });
    const sozu = () => container.querySelector(".account-overview-panel__sozu");

    expect(sozu()).toHaveTextContent(/^Also staked with Sozu: 0\.1621 stDUSK$/);
    // Every decimal on hover.
    expect(
      container.querySelector(".account-overview-panel__sozu-amount")
    ).toHaveAttribute("title", "0.162189471 stDUSK");
    // In the native stake's card, under its amount.
    expect(
      sozu()?.closest(".overview-panel__details-item")?.textContent
    ).toMatch(/^\s*Native stake\s+0 DUSK\s+Also staked with Sozu/);

    for (const stakedDusk of [0n, null]) {
      await rerender({ stakedDusk });

      expect(sozu()).toBeNull();
    }
  });
});
