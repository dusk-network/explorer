import { afterEach, describe, expect, it, vi } from "vitest";
import { base } from "$app/paths";
import { cleanup, render } from "@testing-library/svelte";
import { createLensReader } from "@duskdomains/sdk/lens-reader";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";
import { appStore } from "$lib/stores";

import { PrimaryName } from "..";

vi.mock("@duskdomains/sdk/lens-reader", () => ({ createLensReader: vi.fn() }));

describe("PrimaryName", () => {
  // Names are kept for a minute, so each case looks up its own account.
  const props = (/** @type {number} */ i) => ({
    address: hostProvisioners[i].key,
  });
  const reader = { verifyPrimary: vi.fn() };

  vi.mocked(createLensReader).mockResolvedValue(/** @type {any} */ (reader));
  appStore.setNodeInfo(apiNodeInfo);

  afterEach(() => {
    cleanup();
    reader.verifyPrimary.mockReset();
  });

  it("should give the verified primary name, linked to the account, and its page on Dusk Domains", async () => {
    const { address } = props(0);

    reader.verifyPrimary.mockResolvedValueOnce({
      primary: { spelling: "tdi.dusk" },
    });

    const { findByRole, getByRole, queryByRole } = render(PrimaryName, {
      props: { address, href: `/accounts/?key=${address}` },
    });

    expect(queryByRole("link")).toBeNull();

    const name = await findByRole("link", { name: "tdi.dusk" });

    expect(name).toHaveAttribute("href", `${base}/accounts/?key=${address}`);
    expect(
      getByRole("link", { name: "Open tdi.dusk on Dusk Domains" })
    ).toHaveAttribute("href", "https://testnet.dusk.domains/name/tdi.dusk");
  });

  it("should show the name as text without a link to the account", async () => {
    reader.verifyPrimary.mockResolvedValueOnce({
      primary: { spelling: "tdi.dusk" },
    });

    const { findByText, getAllByRole } = render(PrimaryName, {
      props: props(3),
    });

    expect((await findByText("tdi.dusk")).tagName).toBe("SPAN");
    expect(getAllByRole("link")).toHaveLength(1);
  });

  it.each([
    [
      "has no primary name",
      1,
      () => reader.verifyPrimary.mockResolvedValue(null),
    ],
    [
      "can't be read",
      2,
      () => reader.verifyPrimary.mockRejectedValue(new Error("offline")),
    ],
  ])("should show nothing when the name %s", async (_, i, arrange) => {
    arrange();

    const { container } = render(PrimaryName, { props: props(i) });

    await vi.waitFor(() => expect(reader.verifyPrimary).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve));

    expect(container.textContent).toBe("");
  });
});
