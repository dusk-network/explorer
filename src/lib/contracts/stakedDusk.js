// What an account holds of Sozu's stDUSK, the token Sozu gives for DUSK
// staked with it: one Multicall for Dusk query, which also asks Sozu's hub
// which token it names now, so a token it no longer names isn't read as
// Sozu's. The hub's argument and the replies are as
// `@dusk-network/networks/sozu` gives them.

import {
  HUB_NAME_ARGS,
  decodeContractId,
  decodeU64,
} from "@dusk-network/networks/sozu";

import { failureToRejection } from "$lib/dusk/http";
import { hexToBytes } from "$lib/dusk/string";
import { networkOf } from "$lib/network";
import { makeNodeUrl } from "$lib/url";
import * as base58 from "$lib/utils/encoders/base58";

import { rawAccountKey } from "./rawAccountKey";

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
  const sozu = networkOf(chainId)?.sozu;
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

  const { stDusk } = sozu.fallbacks;

  // Both reads start in this task: the batcher sends them as one query. An
  // account, as Sozu takes it, is `Account::External` (1), then its key.
  const [named, balance] = await Promise.all([
    read(sozu.hub, "contract", hexToBytes(HUB_NAME_ARGS["staked-dusk"])),
    read(stDusk, "balance_of", Uint8Array.of(1, ...raw)),
  ]);

  // A reply that isn't what the contract gives tells nothing.
  try {
    return decodeContractId(named) === stDusk ? decodeU64(balance) : null;
  } catch {
    return null;
  }
}
