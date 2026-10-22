import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeBase58 } from "@duskdomains/sdk";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";

import releases from "../dusk-domains-releases.json";

vi.mock("@duskdomains/sdk/lens-reader", () => ({ createLensReader: vi.fn() }));

const account = hostProvisioners[0].key;
const accountBytes = Array.from(decodeBase58(account) ?? []);

/**
 * Fresh module state on a node of the given chain, with a mocked lens reader.
 *
 * @param {number | undefined} chainId
 */
async function setup(chainId) {
  vi.resetModules();

  const { appStore } = await import("$lib/stores");
  const { createLensReader } = await import("@duskdomains/sdk/lens-reader");
  const reader = { resolve: vi.fn(), verifyPrimary: vi.fn() };
  const createReader = vi
    .mocked(createLensReader)
    .mockReset()
    .mockResolvedValue(/** @type {any} */ (reader));

  // eslint-disable-next-line camelcase
  appStore.setNodeInfo({ ...apiNodeInfo, chain_id: chainId });

  return { createReader, reader, ...(await import("..")) };
}

/**
 * @param {string} status
 * @param {{ value: number[] } | null} record
 */
const resolved = (status, record) => ({
  records: [record],
  status,
  value: status === "Absent" ? "Absent" : { Local: {} },
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDuskName", () => {
  it("should treat only queries ending in .dusk as names", async () => {
    const { isDuskName } = await import("..");

    expect(isDuskName("tdi.dusk")).toBe(true);
    expect(isDuskName(" Sub.TDI.DUSK ")).toBe(true);
    expect(isDuskName(account)).toBe(false);
    expect(isDuskName("123456")).toBe(false);
    expect(isDuskName("dusk")).toBe(false);
    expect(isDuskName("tdi.dusk.network")).toBe(false);
  });
});

describe("resolveDuskName", () => {
  it("should resolve a name through one reader per network, built from the pinned release", async () => {
    vi.stubEnv("VITE_NODE_URL", "https://testnet.nodes.dusk.network");

    const { createReader, reader, resolveDuskName } = await setup(2);

    reader.resolve.mockResolvedValue(
      resolved("Active", { value: accountBytes })
    );

    await expect(resolveDuskName(" TDI.dusk ")).resolves.toBe(account);
    await expect(resolveDuskName("tdi.dusk")).resolves.toBe(account);
    expect(reader.resolve).toHaveBeenCalledWith("tdi.dusk", [
      "moonlight_address",
    ]);
    expect(createReader).toHaveBeenCalledTimes(1);
    expect(createReader).toHaveBeenCalledWith(releases.testnet, {
      artifactBaseUrl: "https://testnet.dusk.domains/",
      nodeUrl: "https://testnet.nodes.dusk.network/",
    });
  });

  it.each([
    ["not registered", "Absent", null, "This name is not registered."],
    ["in grace", "Grace", null, "This name has expired."],
    ["with no address", "Active", null, "This name has no Moonlight address."],
    [
      "with a short address",
      "Active",
      { value: accountBytes.slice(1) },
      "This name has no Moonlight address.",
    ],
  ])(
    "should reject a name %s with a message",
    async (_, status, record, message) => {
      const { reader, resolveDuskName } = await setup(1);

      reader.resolve.mockResolvedValue(resolved(status, record));

      await expect(resolveDuskName("tdi.dusk")).rejects.toThrow(message);
    }
  );

  it("should reject invalid names and failed lookups, and retry a reader that failed to load", async () => {
    const { createReader, reader, resolveDuskName } = await setup(1);
    const lookupFailed = "The name could not be looked up. Please try again.";

    await expect(resolveDuskName("bad_name.dusk")).rejects.toThrow(
      "This is not a valid .dusk name."
    );
    expect(createReader).not.toHaveBeenCalled();

    createReader.mockRejectedValueOnce(new Error("offline"));
    await expect(resolveDuskName("tdi.dusk")).rejects.toThrow(lookupFailed);

    reader.resolve.mockRejectedValueOnce(new Error("HTTP 500"));
    await expect(resolveDuskName("tdi.dusk")).rejects.toThrow(lookupFailed);
    expect(createReader).toHaveBeenCalledTimes(2);
  });
});

describe("getPrimaryName", () => {
  it.each([
    [1, "https://dusk.domains/name/tdi.dusk"],
    [2, "https://testnet.dusk.domains/name/tdi.dusk"],
  ])(
    "should give the verified primary name on chain %i and its page",
    async (chainId, url) => {
      const { reader, getPrimaryName } = await setup(chainId);

      reader.verifyPrimary.mockResolvedValue({
        primary: { spelling: "tdi.dusk" },
      });

      await expect(getPrimaryName(account)).resolves.toStrictEqual({
        name: "tdi.dusk",
        url,
      });
      expect(reader.verifyPrimary).toHaveBeenCalledWith(decodeBase58(account));
    }
  );

  it("should give null without a verified primary or for other input", async () => {
    const { reader, getPrimaryName } = await setup(2);

    reader.verifyPrimary.mockResolvedValue(null);

    await expect(getPrimaryName(account)).resolves.toBeNull();
    await expect(getPrimaryName("abc")).resolves.toBeNull();
    expect(reader.verifyPrimary).toHaveBeenCalledTimes(1);
  });

  it("should look an account up once a minute at most, and retry a failed lookup", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    const { reader, getPrimaryName } = await setup(2);
    const found = {
      name: "tdi.dusk",
      url: "https://testnet.dusk.domains/name/tdi.dusk",
    };

    reader.verifyPrimary
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ primary: { spelling: "tdi.dusk" } });

    await expect(getPrimaryName(account)).rejects.toThrow("offline");
    await expect(getPrimaryName(account)).resolves.toStrictEqual(found);
    await expect(getPrimaryName(account)).resolves.toStrictEqual(found);
    expect(reader.verifyPrimary).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);

    await expect(getPrimaryName(account)).resolves.toStrictEqual(found);
    expect(reader.verifyPrimary).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("should ask the node for its network before the layout has", async () => {
    const { reader, getPrimaryName } = await setup(undefined);
    const { duskAPI } = await import("$lib/services");

    vi.spyOn(duskAPI, "getNodeInfo").mockResolvedValue(apiNodeInfo);
    reader.verifyPrimary.mockResolvedValue({
      primary: { spelling: "tdi.dusk" },
    });

    await expect(getPrimaryName(account)).resolves.toStrictEqual({
      name: "tdi.dusk",
      url: "https://testnet.dusk.domains/name/tdi.dusk",
    });
  });
});

describe("getSearchedName", () => {
  const other = hostProvisioners[1].key;

  it("should give a searched name only when it leads to the account and isn't its primary", async () => {
    const { reader, getSearchedName } = await setup(2);

    reader.resolve.mockResolvedValue(
      resolved("Active", { value: accountBytes })
    );
    reader.verifyPrimary.mockResolvedValue({
      primary: { spelling: "tdi.dusk" },
    });

    await expect(getSearchedName("Domains.dusk ", account)).resolves.toBe(
      "domains.dusk"
    );
    expect(reader.resolve).toHaveBeenCalledWith("domains.dusk", [
      "moonlight_address",
    ]);
    await expect(getSearchedName("TDI.dusk", account)).resolves.toBeNull();
    await expect(getSearchedName("domains.dusk", other)).resolves.toBeNull();
  });

  it("should give null without a name, for other input and when the lookup fails", async () => {
    const { reader, getSearchedName } = await setup(2);

    reader.resolve.mockRejectedValue(new Error("offline"));
    reader.verifyPrimary.mockResolvedValue(null);

    await expect(getSearchedName(null, account)).resolves.toBeNull();
    await expect(getSearchedName("domains", account)).resolves.toBeNull();
    await expect(getSearchedName("domains.dusk", account)).resolves.toBeNull();
  });
});

it("should be off on other networks", async () => {
  const { createReader, getPrimaryName, resolveDuskName } = await setup(3);

  await expect(resolveDuskName("tdi.dusk")).rejects.toThrow(
    "Dusk Domains names are only available on mainnet and testnet."
  );
  await expect(getPrimaryName(account)).resolves.toBeNull();
  expect(createReader).not.toHaveBeenCalled();
});
