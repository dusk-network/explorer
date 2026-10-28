import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aggregateReply } from "$lib/dusk-domains/__tests__/aggregateReply";

import recorded from "./stdusk-testnet.json";

const AGGREGATE =
  "https://nodes.dusk.network/on/contracts:93de287b7d349d678a0038fe7772e8960e1a84a1b5da2d0b1f62f532616ce1d4/aggregate";
const TESTNET_STDUSK =
  "fdbf49102e76cf58224003451c6cb9e3403c54ff1d9042f8bc46ec25c6a4337c";

/** @param {string} hex */
const fromHex = (hex) =>
  Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

/** @param {BodyInit | null | undefined} body */
const toHex = (body) =>
  Buffer.from(/** @type {Uint8Array} */ (body)).toString("hex");

/** @param {bigint} lux */
const u64 = (lux) => {
  const bytes = new Uint8Array(8);

  new DataView(bytes.buffer).setBigUint64(0, lux, true);

  return bytes;
};

/**
 * The hub's answer for "staked-dusk": the token's ID, or none.
 *
 * @param {string | null} id
 */
const named = (id) =>
  id ? Uint8Array.of(1, ...fromHex(id)) : new Uint8Array(33);

describe("getStakedDusk", () => {
  /** @type {typeof import("../stakedDusk").getStakedDusk} */
  let getStakedDusk;

  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(async () => {
    // No node in the tests: each answer is given, and nothing else is.
    fetchSpy.mockRejectedValue(new Error("No node in the tests"));
    // A fresh batcher each time: what one learns stays out of the next.
    vi.resetModules();
    ({ getStakedDusk } = await import("../stakedDusk"));
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("should read an account's stDUSK and the hub's token in one Multicall for Dusk query, as testnet answered", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(fromHex(recorded.reply), { status: 200 })
    );

    await expect(getStakedDusk(recorded.account, 2)).resolves.toBe(
      BigInt(recorded.stDusk)
    );
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0];

    expect(String(url)).toBe(AGGREGATE);
    expect(toHex(init?.body)).toBe(recorded.request);
  });

  it("should give nothing when the hub names another token, or none", async () => {
    for (const id of ["ab".repeat(32), null]) {
      fetchSpy.mockResolvedValueOnce(
        new Response(aggregateReply([{ Ok: named(id) }, { Ok: u64(5n) }]))
      );

      await expect(getStakedDusk(recorded.account, 2)).resolves.toBeNull();
    }

    fetchSpy.mockResolvedValueOnce(
      new Response(
        aggregateReply([{ Ok: named(TESTNET_STDUSK) }, { Ok: u64(5n) }])
      )
    );

    await expect(getStakedDusk(recorded.account, 2)).resolves.toBe(5n);
  });

  it("should read nothing off mainnet and testnet, or for an address that isn't an account's", async () => {
    await expect(getStakedDusk(recorded.account, 3)).resolves.toBeNull();
    await expect(getStakedDusk(recorded.account, null)).resolves.toBeNull();
    await expect(getStakedDusk("not-an-account", 2)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should fail when the node can't be read", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(getStakedDusk(recorded.account, 1)).rejects.toThrow(
      "Failed to fetch"
    );
  });
});
