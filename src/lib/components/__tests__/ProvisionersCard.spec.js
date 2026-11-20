import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";

import { hostProvisioners } from "$lib/mock-data";
import { resolveDuskName } from "$lib/dusk-domains";
import { ProvisionersCard } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  resolveDuskName: vi.fn(),
}));

/*
 * The provisioners a search finds: what it says when it finds none is copy.
 */
describe("Provisioners Card", () => {
  const props = {
    error: null,
    isSmallScreen: false,
    loading: false,
    provisioners: hostProvisioners,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.doUnmock("$lib/dusk-domains");
  });

  /** @param {HTMLElement} container */
  const rowsOf = (container) =>
    Array.from(container.querySelectorAll("tbody tr"), (row) =>
      row.querySelector("a")?.getAttribute("href"),
    );

  /** Waits for the last name lookup to settle, and the card to show it. */
  const lookedUp = async () => {
    await vi
      .mocked(resolveDuskName)
      .mock.results.at(-1)
      ?.value.catch(() => {});
    await tick();
  };

  it("should find provisioners by staking or owner address", async () => {
    const [first] = hostProvisioners;
    const { container, getByRole } = render(ProvisionersCard, { props });
    const search = getByRole("searchbox");

    await fireEvent.input(search, {
      target: { value: first.key.slice(10, 30).toUpperCase() },
    });

    expect(rowsOf(container)).toStrictEqual([
      `/some-base-path/accounts/?key=${first.key}`,
    ]);

    await fireEvent.input(search, { target: { value: "no such address" } });

    expect(rowsOf(container)).toStrictEqual([]);
  });

  it("should find a provisioner by a .dusk name, with one lookup", async () => {
    const third = hostProvisioners[2];
    const { container, getByRole } = render(ProvisionersCard, { props });
    const search = getByRole("searchbox");

    vi.mocked(resolveDuskName).mockResolvedValueOnce(third.key);
    await fireEvent.input(search, { target: { value: "domains.dus" } });
    await fireEvent.input(search, { target: { value: "Domains.dusk" } });

    await vi.waitFor(() =>
      expect(rowsOf(container)).toStrictEqual([
        `/some-base-path/accounts/?key=${third.key}`,
      ]),
    );
    expect(resolveDuskName).toHaveBeenCalledExactlyOnceWith("domains.dusk");

    // A name whose account stakes nothing, and one that doesn't resolve.
    vi.mocked(resolveDuskName).mockResolvedValueOnce("someone-else");
    await fireEvent.input(search, { target: { value: "alice.dusk" } });
    await lookedUp();

    expect(resolveDuskName).toHaveBeenLastCalledWith("alice.dusk");
    expect(rowsOf(container)).toStrictEqual([]);

    vi.mocked(resolveDuskName).mockRejectedValueOnce(new Error("Absent"));
    await fireEvent.input(search, { target: { value: "nobody.dusk" } });
    await lookedUp();

    expect(resolveDuskName).toHaveBeenLastCalledWith("nobody.dusk");
    expect(rowsOf(container)).toStrictEqual([]);
  });

  it.each([[false], [true]])(
    "should leave out a provisioner with no stake until asked, then find it, unranked (phone: %s)",
    async (isSmallScreen) => {
      // One that left, with only its rewards to claim.
      const noStake = /** @type {HostProvisioner} */ (
        hostProvisioners.find(
          (p) => !p.amount && !p.locked_amt && !p.eligibility,
        )
      );
      const { container, getByRole } = render(ProvisionersCard, {
        props: { ...props, isSmallScreen },
      });
      const found = () =>
        Array.from(
          container.querySelectorAll(
            isSmallScreen ? ".provisioners-list" : "tbody tr",
          ),
        );

      await fireEvent.input(getByRole("searchbox"), {
        target: { value: noStake.key },
      });

      expect(found()).toHaveLength(0);

      await fireEvent.click(getByRole("switch"));

      expect(found()).toHaveLength(1);
      expect(
        found()[0].querySelector(`a[href$="?key=${noStake.key}"]`),
      ).not.toBeNull();

      if (isSmallScreen) {
        expect(found()[0].querySelector(".provisioners-list__rank")).toBeNull();
      } else {
        expect(
          found()[0].querySelector(".provisioners-table__rank"),
        ).toHaveTextContent(/^—$/);
      }
    },
  );
});
