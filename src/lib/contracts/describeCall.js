import { duskEvmContracts } from "@dusk-network/networks/duskevm";

import { STAKE_CONTRACT, labelOf, networkOf } from "$lib/network";

/** Plain words for the common calls whose function name says less. */
const stakeCalls = new Map([["withdraw", "Claim rewards"]]);

const duskEvmBridgeCalls = new Map([
  ["depositETHToWithValue", "Deposit to DuskEVM"],
]);

const duskEvmPortalCalls = new Map([
  ["finalizeWithdrawalTransaction", "Claim withdrawal"],
  ["finalizeWithdrawalTransactionExternalProof", "Claim withdrawal"],
  ["proveWithdrawalTransaction", "Prove withdrawal"],
]);

const sozuPoolCalls = new Map([
  ["sozu_stake", "Liquid stake"],
  ["sozu_unstake", "Liquid unstake"],
]);

/**
 * Plain words for what a call to Dusk Domains does, as
 * `@duskdomains/sdk/call-facts` reads it.
 *
 * @type {Map<string, string>}
 */
const duskDomainsCalls = new Map([
  ["issue", "Reserved name issued"],
  ["primary-cleared", "Primary name cleared"],
  ["primary-set", "Primary name set"],
  ["records", "Records changed"],
  ["registration", "Name registered"],
  ["renewal", "Name renewed"],
  ["subname", "Subname created"],
]);

/**
 * The plain words for the calls to a contract, on the node's network.
 *
 * @param {string} contractId
 * @param {number | null | undefined} chainId
 * @returns {Map<string, string> | undefined}
 */
function callsTo(contractId, chainId) {
  const network = networkOf(chainId);
  const bridge = network && duskEvmContracts(network);

  switch (contractId) {
    case STAKE_CONTRACT:
      return stakeCalls;
    case bridge?.bridge:
      return duskEvmBridgeCalls;
    case bridge?.portal:
      return duskEvmPortalCalls;
    case network?.sozu?.fallbacks.pool:
      return sozuPoolCalls;
    default:
      return undefined;
  }
}

/**
 * The name of a known contract, and plain words for a common call to it.
 * Either is `null` when there is none. The names are the labels of the
 * node's network in `@dusk-network/networks`, and Dusk Domains' contracts
 * are known by its release; contracts others deployed are known on their
 * own network only, once the node has said which it is on. It reads
 * nothing from the node.
 *
 * @param {string} contractId
 * @param {string} method
 * @param {number | null} [chainId] The node's network
 * @returns {Promise<{ label: string | null, name: string | null }>}
 */
async function describeCall(contractId, method, chainId = undefined) {
  const name = labelOf(chainId, contractId);

  if (name) {
    return {
      label: callsTo(contractId, chainId)?.get(method) ?? null,
      name,
    };
  }

  const call =
    typeof chainId === "number"
      ? await import("@duskdomains/sdk/call-facts").then(
          ({ nameCall }) => nameCall({ contractId, fnName: method }, chainId),
          () => null
        )
      : null;

  return call
    ? { label: duskDomainsCalls.get(call.kind) ?? null, name: "Dusk Domains" }
    : { label: null, name: null };
}

export default describeCall;
