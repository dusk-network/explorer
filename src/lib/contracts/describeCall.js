import {
  MULTICALL_CONTRACT,
  STAKE_CONTRACT,
  TRANSFER_CONTRACT,
} from "$lib/constants";
import { isDuskDomainsContract } from "$lib/dusk-domains";

/** @type {Map<string, string>} */
const contractNames = new Map([
  [MULTICALL_CONTRACT, "Multicall"],
  [STAKE_CONTRACT, "Stake contract"],
  [TRANSFER_CONTRACT, "Transfer contract"],
]);

/**
 * Plain words for the common calls whose method name says less.
 *
 * @type {Map<string, string>}
 */
const stakeLabels = new Map([["withdraw", "Claim rewards"]]);

/** @type {Map<string, string>} */
const duskDomainsLabels = new Map([
  ["clear_primary", "Primary name cleared"],
  ["create_subname", "Subname created"],
  ["issue_reserved", "Reserved name issued"],
  ["mutate_records", "Records changed"],
  ["register", "Name registered"],
  ["renew", "Name renewed"],
  ["set_primary", "Primary name set"],
]);

/**
 * The name of a known contract, and plain words for a common call to it.
 * Either is `null` when there is none. It reads nothing from the node.
 *
 * @param {string} contractId
 * @param {string} method
 * @returns {Promise<{ label: string | null, name: string | null }>}
 */
async function describeCall(contractId, method) {
  const name = contractNames.get(contractId);

  if (name) {
    return {
      label:
        contractId === STAKE_CONTRACT
          ? (stakeLabels.get(method) ?? null)
          : null,
      name,
    };
  }

  return (await isDuskDomainsContract(contractId).catch(() => false))
    ? { label: duskDomainsLabels.get(method) ?? null, name: "Dusk Domains" }
    : { label: null, name: null };
}

export default describeCall;
