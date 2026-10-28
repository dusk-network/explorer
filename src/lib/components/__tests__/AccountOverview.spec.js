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
    expect(
      container.querySelector(".account-overview-panel__kind")
    ).toHaveTextContent(/^Account$/);
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
});
