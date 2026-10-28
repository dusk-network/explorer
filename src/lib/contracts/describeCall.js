import {
  MULTICALL_CONTRACT,
  STAKE_CONTRACT,
  TRANSFER_CONTRACT,
} from "$lib/constants";
import { isDuskDomainsContract } from "$lib/dusk-domains";

import {
  DUSKEVM_BRIDGE_CONTRACTS,
  SOZU_CONTRACTS,
  networkKeyOf,
} from "./knownContracts";

/**
 * @typedef {{ labels?: Map<string, string>, name: string }} KnownContract
 */

/**
 * The protocol's contracts, the same on every network.
 *
 * @type {Map<string, KnownContract>}
 */
const protocolContracts = new Map([
  [MULTICALL_CONTRACT, { name: "Multicall" }],
  [
    STAKE_CONTRACT,
    // Plain words for the common calls whose method name says less.
    {
      labels: new Map([["withdraw", "Claim rewards"]]),
      name: "Stake contract",
    },
  ],
  [TRANSFER_CONTRACT, { name: "Transfer contract" }],
]);

/** @type {KnownContract} */
const duskEvmBridge = {
  labels: new Map([["depositETHToWithValue", "Deposit to DuskEVM"]]),
  name: "DuskEVM bridge",
};

/** @type {KnownContract} */
const duskEvmPortal = {
  labels: new Map([
    ["finalizeWithdrawalTransaction", "Claim withdrawal"],
    ["finalizeWithdrawalTransactionExternalProof", "Claim withdrawal"],
    ["proveWithdrawalTransaction", "Prove withdrawal"],
  ]),
  name: "DuskEVM bridge portal",
};

/** @type {KnownContract} */
const sozu = {
  labels: new Map([
    ["sozu_stake", "Liquid stake"],
    ["sozu_unstake", "Liquid unstake"],
  ]),
  name: "Sozu liquid staking",
};

/**
 * Contracts others deployed, on the network they are on.
 *
 * @type {Record<string, Map<string, KnownContract>>}
 */
const networkContracts = Object.fromEntries(
  ["mainnet", "testnet"].map((network) => {
    /** @type {Map<string, KnownContract>} */
    const known = new Map();
    const bridge = DUSKEVM_BRIDGE_CONTRACTS[network];
    const pool = SOZU_CONTRACTS[network];

    if (bridge) {
      known.set(bridge.bridge, duskEvmBridge).set(bridge.portal, duskEvmPortal);
    }

    known.set(pool.hub, sozu).set(pool.pool, sozu);

    return [network, known];
  })
);

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
 * Either is `null` when there is none. Contracts others deployed, Dusk
 * Domains' among them, are known on their own network only, once the node
 * has said which it is on. It reads nothing from the node.
 *
 * @param {string} contractId
 * @param {string} method
 * @param {number | null} [chainId] The node's network
 * @returns {Promise<{ label: string | null, name: string | null }>}
 */
async function describeCall(contractId, method, chainId = undefined) {
  const network = networkKeyOf(chainId);
  const known =
    protocolContracts.get(contractId) ??
    (network ? networkContracts[network].get(contractId) : undefined);

  if (known) {
    return { label: known.labels?.get(method) ?? null, name: known.name };
  }

  return (await isDuskDomainsContract(contractId, chainId).catch(() => false))
    ? { label: duskDomainsLabels.get(method) ?? null, name: "Dusk Domains" }
    : { label: null, name: null };
}

export default describeCall;
