import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { slice } from "lamb";

import { hostProvisioners } from "$lib/mock-data";
import { resolveDuskName } from "$lib/dusk-domains";
import { ProvisionersCard } from "..";

import { itShowsItsListAPageAtATime } from "./pagedCard";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  resolveDuskName: vi.fn(),
}));

describe("Provisioners Card", () => {
  const data = slice(hostProvisioners, 0, 10);

  const baseProps = {
    error: null,
    isSmallScreen: false,
    loading: false,
    provisioners: null,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  afterAll(() => {
    vi.doUnmock("$lib/dusk-domains");
  });

  itShowsItsListAPageAtATime({
    Card: ProvisionersCard,
    few: data,
    list: "provisioners",
    many: hostProvisioners,
    name: "ProvisionersCard",
    props: baseProps,
    title: "Provisioners",
    // Of the 216, the 214 with a stake.
    total: 214,
  });

  it("should find provisioners by staking or owner address", async () => {
    const [first] = hostProvisioners;
    const { container, getByRole } = render(ProvisionersCard, {
      ...baseOptions,
      props: { ...baseProps, provisioners: hostProvisioners },
    });
    const search = getByRole("searchbox", {
      name: "Search provisioners by staking or owner address, or .dusk name",
    });
    const rows = () =>
      Array.from(container.querySelectorAll("tbody tr"), (row) =>
        row.querySelector("a")?.getAttribute("href")
      );

    await fireEvent.input(search, {
      target: { value: first.key.slice(10, 30).toUpperCase() },
    });

    expect(rows()).toStrictEqual([
      `/some-base-path/accounts/?key=${first.key}`,
    ]);

    await fireEvent.input(search, { target: { value: "no such address" } });

    expect(rows()).toStrictEqual([]);
    expect(container.textContent).toContain(
      "No provisioner has an address with “no such address”."
    );
    // Nothing found has no count to give.
    expect(container.querySelector(".data-card__count")).toBeNull();
  });

  it("should find a provisioner by a .dusk name, with one lookup", async () => {
    const third = hostProvisioners[2];
    const { container, findByText, getByRole } = render(ProvisionersCard, {
      ...baseOptions,
      props: { ...baseProps, provisioners: hostProvisioners },
    });
    const search = getByRole("searchbox");
    const rows = () =>
      Array.from(container.querySelectorAll("tbody tr"), (row) =>
        row.querySelector("a")?.getAttribute("href")
      );

    vi.mocked(resolveDuskName).mockResolvedValueOnce(third.key);
    await fireEvent.input(search, { target: { value: "domains.dus" } });
    await fireEvent.input(search, { target: { value: "Domains.dusk" } });

    await vi.waitFor(() =>
      expect(rows()).toStrictEqual([
        `/some-base-path/accounts/?key=${third.key}`,
      ])
    );
    expect(resolveDuskName).toHaveBeenCalledExactlyOnceWith("domains.dusk");

    vi.mocked(resolveDuskName).mockResolvedValueOnce("someone-else");
    await fireEvent.input(search, { target: { value: "alice.dusk" } });

    expect(
      await findByText("No provisioner has alice.dusk's address.")
    ).toBeInTheDocument();

    vi.mocked(resolveDuskName).mockRejectedValueOnce(
      new Error("This name is not registered.")
    );
    await fireEvent.input(search, { target: { value: "nobody.dusk" } });

    expect(
      await findByText("This name is not registered.")
    ).toBeInTheDocument();
  });

  it.each([[false], [true]])(
    "should show those with no stake only when asked, after the others and unranked (phone: %s)",
    async (isSmallScreen) => {
      const noStake = hostProvisioners.find(
        (p) => !p.amount && !p.locked_amt && !p.eligibility
      );
      const { container, getByLabelText, getByRole, queryByRole } = render(
        ProvisionersCard,
        {
          ...baseOptions,
          props: {
            ...baseProps,
            isSmallScreen,
            provisioners: hostProvisioners,
          },
        }
      );
      const count = () =>
        container.querySelector(".data-card__count")?.textContent;
      const rows = () =>
        container.querySelectorAll(
          isSmallScreen ? ".provisioners-list" : "tbody tr"
        );
      const toggle = getByRole("switch", {
        name: "Show provisioners with no stake",
      });

      expect(container).toHaveTextContent("Show 2 with no stake");
      expect(count()).toBe("15 of 214");

      // Off, searching for one finds nothing.
      await fireEvent.input(getByLabelText(/^Search provisioners/), {
        target: { value: noStake?.key },
      });
      expect(rows()).toHaveLength(0);

      await fireEvent.click(toggle);

      expect(rows()).toHaveLength(1);

      if (isSmallScreen) {
        expect(container.querySelector(".provisioners-list__rank")).toBeNull();
      } else {
        expect(
          container.querySelector(".provisioners-table__rank")
        ).toHaveTextContent(/^—$/);
      }

      await fireEvent.input(getByLabelText(/^Search provisioners/), {
        target: { value: "" },
      });

      expect(count()).toBe("15 of 216");
      expect(queryByRole("button", { name: "Show more" })).toBeInTheDocument();
    }
  );

  it("should offer no switch when every provisioner has a stake", () => {
    const { queryByRole } = render(ProvisionersCard, {
      ...baseOptions,
      props: {
        ...baseProps,
        provisioners: hostProvisioners.filter(
          (p) => p.amount || p.locked_amt || p.eligibility
        ),
      },
    });

    expect(queryByRole("switch")).toBeNull();
  });
});
