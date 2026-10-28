import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { slice } from "lamb";

import { apiNodeInfo, enrichedProvisioners } from "$lib/mock-data";
import { appStore } from "$lib/stores";

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

  it("should name an owner its network's labels name, and give any other contract's ID short", async () => {
    const ownedBy = (/** @type {string} */ ownerAddress) =>
      render(ProvisionersList, {
        data: {
          ...provisioners,
          hasSeparateOwner: true,
          ownerAddress,
          ownerType: "Contract",
        },
      }).container.querySelector("dd:last-of-type");

    // On testnet, where the stake of Sozu's relayer is.
    await act(() => appStore.setNodeInfo(apiNodeInfo));

    expect(
      ownedBy(
        "51ced4fad52fc590def2736969c9e3e30013275a996c53714b81d8a08774aa37"
      )
    ).toHaveTextContent(/^Sozu relayer$/);
    expect(ownedBy("ab".repeat(32))).toHaveTextContent(
      /^Contract ababab…ababab$/
    );

    await act(() =>
      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined })
    );
  });
});
