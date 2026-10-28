import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { slice } from "lamb";
import { apiNodeInfo, enrichedProvisioners } from "$lib/mock-data";
import { appStore } from "$lib/stores";

import { ProvisionersTable } from "..";

describe("Provisioners Table", () => {
  const data = slice(enrichedProvisioners, 0, 10);

  const baseProps = {
    data: data,
  };
  const baseOptions = {
    props: baseProps,
    target: document.body,
  };

  afterEach(cleanup);

  it("should render the `ProvisionersTable` component", () => {
    const { container } = render(ProvisionersTable, baseOptions);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should name an owner its network's labels name, and give any other contract's ID short", async () => {
    const relayer =
      "51ced4fad52fc590def2736969c9e3e30013275a996c53714b81d8a08774aa37";
    const { container } = render(ProvisionersTable, {
      ...baseOptions,
      props: {
        data: [relayer, "ab".repeat(32)].map((ownerAddress, index) => ({
          ...data[index],
          hasSeparateOwner: true,
          ownerAddress,
          ownerType: "Contract",
        })),
      },
    });
    const owners = () =>
      Array.from(
        container.querySelectorAll(".provisioners-table__owner"),
        (owner) => owner.textContent?.trim()
      );

    expect(owners()).toStrictEqual([
      "Contract 51ced4…74aa37",
      "Contract ababab…ababab",
    ]);

    // On testnet, where the stake of Sozu's relayer is.
    await act(() => appStore.setNodeInfo(apiNodeInfo));

    expect(owners()).toStrictEqual(["Sozu relayer", "Contract ababab…ababab"]);

    await act(() =>
      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined })
    );
  });
});
