import { isDuskDomainsContract } from "$lib/dusk-domains";
import {
  STAKE_CONTRACT,
  duskEvmBridgeOf,
  labelOf,
  networkOf,
} from "$lib/network";

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

/** @type {Map<string, string>} */
const duskDomainsCalls = new Map([
  ["clear_primary", "Primary name cleared"],
  ["create_subname", "Subname created"],
  ["issue_reserved", "Reserved name issued"],
  ["mutate_records", "Records changed"],
  ["register", "Name registered"],
  ["renew", "Name renewed"],
  ["set_primary", "Primary name set"],
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
  const bridge = duskEvmBridgeOf(network);

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

  return (await isDuskDomainsContract(contractId, chainId).catch(() => false))
    ? { label: duskDomainsCalls.get(method) ?? null, name: "Dusk Domains" }
    : { label: null, name: null };
}

export default describeCall;
