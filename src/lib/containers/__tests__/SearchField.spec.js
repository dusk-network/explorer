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

  /**
   * The detail of the only `invalid` event, once it is sent.
   *
   * @param {import("vitest").Mock} onInvalid
   */
  async function getMiss(onInvalid) {
    await vi.waitFor(() => expect(onInvalid).toHaveBeenCalledTimes(1));

    return onInvalid.mock.calls[0][0].detail;
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
        `/some-base-path/accounts/?key=${account}&name=tdi.dusk`
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

    await expect(getMiss(onInvalid)).resolves.toStrictEqual({
      query: "nobody.dusk",
      res: new Error("This name is not registered."),
      suggestion: undefined,
    });
    expect(gotoSpy).not.toHaveBeenCalled();
  });

  it("should keep what was typed and say what didn't match", async () => {
    const onInvalid = await search("e5f314fb49a8a2f8");

    await expect(getMiss(onInvalid)).resolves.toStrictEqual({
      query: "e5f314fb49a8a2f8",
      res: new Error(
        "This looks like the start of an ID. Search with the whole ID, 64 characters."
      ),
      suggestion: undefined,
    });
    expect(document.querySelector("input")).toHaveValue("e5f314fb49a8a2f8");
    expect(gotoSpy).not.toHaveBeenCalled();
  });

  it("should offer the .dusk name a word could be", async () => {
    const onInvalid = await search("Alice");

    await expect(getMiss(onInvalid)).resolves.toMatchObject({
      query: "Alice",
      suggestion: "alice.dusk",
    });
  });

  it("should explain input it can't search for without asking the node", async () => {
    const onInvalid = await search("bad_name");

    await expect(getMiss(onInvalid)).resolves.toStrictEqual({
      query: "bad_name",
      res: new Error(
        "Search by account address, block height or hash, transaction ID or .dusk name."
      ),
      suggestion: undefined,
    });
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("should search for the text it is given, as if typed", async () => {
    reader.resolve.mockResolvedValueOnce({
      records: [{ value: Array.from(decodeBase58(account) ?? []) }],
      status: "Active",
      value: { Local: {} },
    });

    const { component } = render(SearchField);

    component.search("alice.dusk");

    await vi.waitFor(() =>
      expect(gotoSpy).toHaveBeenCalledWith(
        `/some-base-path/accounts/?key=${account}&name=alice.dusk`
      )
    );
  });

  it("should label the search field and say it takes .dusk names", () => {
    const { getByRole } = render(SearchField);

    expect(
      getByRole("textbox", {
        name: "Search by address, block, transaction or .dusk name",
      })
    ).toHaveAttribute("placeholder", "Address, hash or .dusk name");
  });

  it("should name the search button", () => {
    const { getByRole } = render(SearchField);

    expect(getByRole("button", { name: "Search" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("should search any other input as before", async () => {
    await search(account);

    expect(searchSpy).toHaveBeenCalledWith(account);
    expect(reader.resolve).not.toHaveBeenCalled();
  });
});
