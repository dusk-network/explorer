import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { createLensReader } from "@duskdomains/sdk/lens-reader";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";
import { appStore } from "$lib/stores";

import { PrimaryName } from "..";

vi.mock("@duskdomains/sdk/lens-reader", () => ({ createLensReader: vi.fn() }));

describe("PrimaryName", () => {
  const props = { address: hostProvisioners[0].key };
  const reader = { verifyPrimary: vi.fn() };

  vi.mocked(createLensReader).mockResolvedValue(/** @type {any} */ (reader));
  appStore.setNodeInfo(apiNodeInfo);

  afterEach(() => {
    cleanup();
    reader.verifyPrimary.mockReset();
  });

  it("should link the account's verified primary name to its Dusk Domains page", async () => {
    reader.verifyPrimary.mockResolvedValueOnce({
      primary: { spelling: "tdi.dusk" },
    });

    const { findByRole, queryByRole } = render(PrimaryName, { props });

    expect(queryByRole("link")).toBeNull();

    const link = await findByRole("link");

    expect(link).toHaveTextContent("tdi.dusk");
    expect(link).toHaveAttribute(
      "href",
      "https://testnet.dusk.domains/name/tdi.dusk"
    );
  });

  it.each([
    ["has no primary name", () => reader.verifyPrimary.mockResolvedValue(null)],
    [
      "can't be read",
      () => reader.verifyPrimary.mockRejectedValue(new Error("offline")),
    ],
  ])("should show nothing when the name %s", async (_, arrange) => {
    arrange();

    const { container } = render(PrimaryName, { props });

    await vi.waitFor(() => expect(reader.verifyPrimary).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve));

    expect(container.textContent).toBe("");
  });
});
