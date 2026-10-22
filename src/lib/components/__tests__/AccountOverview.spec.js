import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

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

  it("should show the searched name once it leads to the account", async () => {
    vi.mocked(getSearchedName).mockResolvedValue("domains.dusk");

    const { container } = render(AccountOverview, {
      ...baseProps,
      searchedName: "Domains.dusk",
    });

    await vi.waitFor(() =>
      expect(
        container.querySelector(".account-overview-panel__searched-name")
          ?.textContent
      ).toContain("domains.dusk points to this account")
    );
    expect(getSearchedName).toHaveBeenCalledWith(
      "Domains.dusk",
      accountAddress
    );
  });

  it("should show no searched name when there is none to show", async () => {
    const { container } = render(AccountOverview, baseProps);

    await vi.waitFor(() => expect(getPrimaryName).toHaveBeenCalled());
    expect(getSearchedName).toHaveBeenCalledWith(null, accountAddress);
    expect(
      container.querySelector(".account-overview-panel__searched-name")
    ).toBeNull();
  });
});
