import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeBase58 } from "@duskdomains/sdk";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";

import releases from "../dusk-domains-releases.json";
import { aggregateReply, countCalls } from "./aggregateReply";

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
      fetch: expect.any(Function),
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
      new Error(
        "This is not a valid .dusk name. Names use a–z, 0–9 and hyphens, and don't start or end with a hyphen."
      )
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

  it("should look an account up once a session, and retry a failed lookup", async () => {
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

    vi.advanceTimersByTime(3_600_000);

    await expect(getPrimaryName(account)).resolves.toStrictEqual(found);
    expect(reader.verifyPrimary).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("should look up again alone a name the lens refused for want of gas in a batch", async () => {
    const { createReader, getPrimaryName } = await setup(2);
    const refused = Object.assign(new Error("Lens refused: GasBudget"), {
      reason: "refused",
      refusal: { cause: null, code: "GasBudget" },
    });
    const batched = {
      resolve: vi.fn(),
      verifyPrimary: vi.fn().mockRejectedValue(refused),
    };
    const direct = {
      resolve: vi.fn(),
      verifyPrimary: vi
        .fn()
        .mockResolvedValue({ primary: { spelling: "tdi.dusk" } }),
    };

    createReader
      .mockResolvedValueOnce(/** @type {any} */ (batched))
      .mockResolvedValueOnce(/** @type {any} */ (direct));

    await expect(getPrimaryName(account)).resolves.toStrictEqual({
      name: "tdi.dusk",
      url: "https://testnet.dusk.domains/name/tdi.dusk",
    });
    expect(batched.verifyPrimary).toHaveBeenCalledTimes(1);
    expect(direct.verifyPrimary).toHaveBeenCalledExactlyOnceWith(
      decodeBase58(account)
    );
    // The batched reader reads through Multicall for Dusk, the direct one not.
    expect(createReader.mock.calls[0][1]).toHaveProperty("fetch");
    expect(createReader.mock.calls[1][1]).not.toHaveProperty("fetch");
  });

  it("should leave any other failed lookup failed, without reading it again", async () => {
    const { createReader, reader, getPrimaryName, getPrimaryNames } =
      await setup(2);
    const other = hostProvisioners[1].key;

    reader.verifyPrimary
      .mockRejectedValueOnce(
        Object.assign(new Error("Lens evidence does not check"), {
          reason: "evidence",
        })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Lens refused: InvalidEndpoint"), {
          reason: "refused",
          refusal: { cause: null, code: "InvalidEndpoint" },
        })
      );

    await expect(getPrimaryName(account)).rejects.toThrow(
      "Lens evidence does not check"
    );
    await expect(getPrimaryNames([other])).resolves.toStrictEqual(new Map());
    expect(reader.verifyPrimary).toHaveBeenCalledTimes(2);
    expect(createReader).toHaveBeenCalledTimes(1);

    // Nor is a failure kept: the next lookup reads again.
    reader.verifyPrimary.mockResolvedValue(null);

    await expect(getPrimaryNames([account, other])).resolves.toStrictEqual(
      new Map([
        [account, null],
        [other, null],
      ])
    );
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

describe("getPrimaryNames", () => {
  const multicall =
    "93de287b7d349d678a0038fe7772e8960e1a84a1b5da2d0b1f62f532616ce1d4";
  const accounts = hostProvisioners.slice(0, 5).map(({ key }) => key);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should look up a list's accounts in one Multicall for Dusk query, each once a session", async () => {
    vi.stubEnv("VITE_NODE_URL", "https://testnet.nodes.dusk.network");

    const { createReader, getPrimaryNames } = await setup(2);
    const lens = releases.testnet.lens.contractId;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_, init) => {
        const calls = countCalls(init?.body);
        const names = Array.from({ length: calls }, (slot, i) => ({
          Ok: new TextEncoder().encode(i % 2 ? "" : `name${i}.dusk`),
        }));

        return new Response(aggregateReply(names));
      });

    // A reader that sends each read through the fetch it was given, as the
    // SDK's transport does, and reads a name from its reply.
    createReader.mockImplementation(
      async (_, options) =>
        /** @type {any} */ ({
          resolve: vi.fn(),
          verifyPrimary: async (/** @type {Uint8Array} */ endpoint) => {
            const fetch = /** @type {typeof globalThis.fetch} */ (
              options.fetch
            );
            const res = await fetch(
              `https://testnet.nodes.dusk.network/on/contracts:${lens}/reverse`,
              { body: new Uint8Array(endpoint), method: "POST" }
            );
            const spelling = new TextDecoder().decode(await res.arrayBuffer());

            return spelling ? { primary: { spelling } } : null;
          },
        })
    );

    const names = await getPrimaryNames([...accounts, accounts[0], null]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      `https://testnet.nodes.dusk.network/on/contracts:${multicall}/aggregate`
    );
    expect(countCalls(fetchSpy.mock.calls[0][1]?.body)).toBe(5);
    expect([...names]).toStrictEqual(
      accounts.map((address, i) => [
        address,
        i % 2
          ? null
          : {
              name: `name${i}.dusk`,
              url: `https://testnet.dusk.domains/name/name${i}.dusk`,
            },
      ])
    );

    // The same accounts again: the names are kept for the session.
    await getPrimaryNames(accounts);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
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

    await expect(
      getSearchedName("Domains.dusk ", account)
    ).resolves.toStrictEqual({
      name: "domains.dusk",
      url: `${releases.testnet.site}/name/domains.dusk`,
    });
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

describe("isDuskDomainsContract", () => {
  it("should know the contracts of the pinned releases, and only those", async () => {
    const { isDuskDomainsContract } = await import("..");
    const ids = Object.values(releases).flatMap((release) => [
      release.lens.contractId,
      ...release.contracts.map(({ contractId }) => contractId),
    ]);

    for (const id of ids) {
      await expect(isDuskDomainsContract(id)).resolves.toBe(true);
    }

    await expect(
      isDuskDomainsContract(
        "0200000000000000000000000000000000000000000000000000000000000000"
      )
    ).resolves.toBe(false);
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
