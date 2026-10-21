import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import * as appNavigation from "$app/navigation";
import { decodeBase58 } from "@duskdomains/sdk";
import { createLensReader } from "@duskdomains/sdk/lens-reader";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

import { SearchField } from "..";

vi.mock("@duskdomains/sdk/lens-reader", () => ({ createLensReader: vi.fn() }));

describe("SearchField", () => {
  const account = hostProvisioners[0].key;
  const reader = { resolve: vi.fn() };
  const gotoSpy = vi.spyOn(appNavigation, "goto");
  const searchSpy = vi.spyOn(duskAPI, "search").mockResolvedValue(null);

  vi.mocked(createLensReader).mockResolvedValue(/** @type {any} */ (reader));
  appStore.setNodeInfo(apiNodeInfo);

  /** @param {string} query */
  async function search(query) {
    const onInvalid = vi.fn();
    const { getByRole } = render(SearchField, {
      events: { invalid: onInvalid },
    });
    const input = getByRole("textbox");

    await fireEvent.input(input, { target: { value: query } });
    await fireEvent.submit(
      /** @type {HTMLFormElement} */ (input.closest("form"))
    );

    return onInvalid;
  }

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should open the account a .dusk name resolves to", async () => {
    reader.resolve.mockResolvedValueOnce({
      records: [{ value: Array.from(decodeBase58(account) ?? []) }],
      status: "Active",
      value: { Local: {} },
    });

    await search("TDI.dusk");

    await vi.waitFor(() =>
      expect(gotoSpy).toHaveBeenCalledWith(
        `/some-base-path/accounts/?key=${account}`
      )
    );
    expect(reader.resolve).toHaveBeenCalledWith("tdi.dusk", [
      "moonlight_address",
    ]);
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("should show the search notification when a name has no account", async () => {
    reader.resolve.mockResolvedValueOnce({
      records: [null],
      status: "Absent",
      value: "Absent",
    });

    const onInvalid = await search("nobody.dusk");

    await vi.waitFor(() => expect(onInvalid).toHaveBeenCalledTimes(1));
    expect(onInvalid.mock.calls[0][0].detail).toStrictEqual({
      query: "nobody.dusk",
      res: new Error("This name is not registered."),
    });
    expect(gotoSpy).not.toHaveBeenCalled();
  });

  it("should search any other input as before", async () => {
    await search(account);

    expect(searchSpy).toHaveBeenCalledWith(account);
    expect(reader.resolve).not.toHaveBeenCalled();
  });
});
