import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { slice } from "lamb";

import { enrichedProvisioners } from "$lib/mock-data";

import { ProvisionersList } from "..";

describe("Provisioners List", () => {
  const provisioners = slice(enrichedProvisioners, 0, 1)[0];

  /** @type {import("svelte").ComponentProps<ProvisionersList>} */
  const baseProps = { data: provisioners };

  afterEach(cleanup);

  it("renders the `ProvisionersList` component", () => {
    const { container } = render(ProvisionersList, baseProps);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  /** @param {HTMLElement} container */
  const getTerms = (container) =>
    Array.from(container.querySelectorAll("dt"), (dt) =>
      dt.textContent?.trim().toLowerCase()
    );

  it("should keep a provisioner to a few rows, linking to its stake and rewards", () => {
    const { container, getByRole } = render(ProvisionersList, baseProps);

    expect(getTerms(container)).toStrictEqual([
      "provisioner",
      "stake",
      "reward",
      "slashes",
    ]);
    expect(
      getByRole("link", { name: new RegExp(provisioners.key.slice(0, 4)) })
    ).toHaveAttribute(
      "href",
      `/some-base-path/accounts/?key=${provisioners.key}`
    );
  });

  it("should name the owner only when it isn't the staking key", () => {
    const { container } = render(ProvisionersList, {
      data: {
        ...provisioners,
        hasSeparateOwner: true,
        ownerAddress: enrichedProvisioners[1].key,
        ownerType: "Account",
      },
    });

    expect(getTerms(container)).toContain("owner");
  });
});
