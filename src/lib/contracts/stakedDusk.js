// What an account holds of Sozu's stDUSK, the token Sozu gives for DUSK
// staked with it: one Multicall for Dusk query, which also asks Sozu's hub
// which token it names now, so a token it no longer names isn't read as
// Sozu's. The arguments are the bytes Sozu's own data drivers give.

import { failureToRejection } from "$lib/dusk/http";
import { makeNodeUrl } from "$lib/url";
import * as base58 from "$lib/utils/encoders/base58";

import { SOZU_CONTRACTS, networkKeyOf } from "./knownContracts";
import { rawAccountKey } from "./rawAccountKey";

/** The hub's `contract` argument for "staked-dusk", an rkyv string. */
const STAKED_DUSK = "7374616b65642d6475736b000b000000f4ffffff";

/** @param {string} hex */
const fromHex = (hex) =>
  Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));

/** @param {Uint8Array} bytes */
const toHex = (bytes) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * The batched fetch of each node, kept so it learns the node's replies.
 *
 * @type {Map<string, Promise<typeof fetch>>}
 */
const batchedFetches = new Map();

/** @param {string} nodeUrl */
function batchedFetch(nodeUrl) {
  let batched = batchedFetches.get(nodeUrl);

  if (!batched) {
    batched = import("$lib/dusk-domains/multicallFetch").then(
      ({ createMulticallFetch }) => createMulticallFetch({ nodeUrl })
    );
    batchedFetches.set(nodeUrl, batched);
    batched.catch(() => batchedFetches.delete(nodeUrl));
  }

  return batched;
}

/**
 * The stDUSK an account holds, in its smallest unit, or `null` when it
 * can't be told: off mainnet and testnet, for an address that isn't an
 * account, or when the hub names another token.
 *
 * @param {string} address
 * @param {number | null | undefined} chainId The node's network
 * @returns {Promise<bigint | null>}
 */
export async function getStakedDusk(address, chainId) {
  const network = networkKeyOf(chainId);
  const sozu = network ? SOZU_CONTRACTS[network] : undefined;
  const key = base58.decode(address);
  const raw = key?.length === 96 ? rawAccountKey(key) : null;

  if (!sozu || !raw) {
    return null;
  }

  const fetchBatched = await batchedFetch(makeNodeUrl("/").href);

  /**
   * @param {string} contract
   * @param {string} fn
   * @param {Uint8Array<ArrayBuffer>} args
   */
  const read = (contract, fn, args) =>
    fetchBatched(makeNodeUrl(`/on/contracts:${contract}/${fn}`), {
      body: args,
      headers: {
        Accept: "application/octet-stream",
        "Content-Type": "application/octet-stream",
      },
      method: "POST",
    })
      .then(failureToRejection)
      .then((res) => res.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer));

  // Both reads start in this task: the batcher sends them as one query. An
  // account, as Sozu takes it, is `Account::External` (1), then its key.
  const [named, balance] = await Promise.all([
    read(sozu.hub, "contract", fromHex(STAKED_DUSK)),
    read(sozu.stDusk, "balance_of", Uint8Array.of(1, ...raw)),
  ]);

  // The hub's answer is an `Option<ContractId>`: 1, then the ID.
  const isNamed =
    named.length === 33 &&
    named[0] === 1 &&
    toHex(named.subarray(1)) === sozu.stDusk;

  return isNamed && balance.length === 8
    ? new DataView(balance.buffer, balance.byteOffset).getBigUint64(0, true)
    : null;
}
