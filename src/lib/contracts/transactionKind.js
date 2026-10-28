import { STAKE_CONTRACT } from "$lib/constants";

import {
  DUSKEVM_BRIDGE_CONTRACTS,
  SOZU_CONTRACTS,
  networkKeyOf,
} from "./knownContracts";

/**
 * @typedef {"bridge" | "call" | "shielded" | "staking" | "transfer"} TransactionKind
 */

/**
 * What a call to a contract was for, by the contract: the DuskEVM bridge,
 * staking (natively or with Sozu), or anything else. Contracts others
 * deployed count on their own network only.
 *
 * @param {string} contract
 * @param {"mainnet" | "testnet" | null} network
 * @returns {TransactionKind}
 */
function callKind(contract, network) {
  const bridge = network ? DUSKEVM_BRIDGE_CONTRACTS[network] : undefined;
  const sozu = network ? SOZU_CONTRACTS[network] : undefined;

  if (bridge && [bridge.bridge, bridge.portal].includes(contract)) {
    return "bridge";
  }

  if (
    contract === STAKE_CONTRACT ||
    (sozu && [sozu.hub, sozu.pool].includes(contract))
  ) {
    return "staking";
  }

  return "call";
}

/**
 * What a transaction did, as a list's icon shows it: crossed the DuskEVM
 * bridge, staked (natively or with Sozu), called another contract, moved
 * DUSK in the open, or moved it shielded. It reads nothing from the node.
 *
 * @param {Transaction} tx
 * @param {number | null} [chainId] The node's network
 * @returns {TransactionKind}
 */
function transactionKind(tx, chainId = undefined) {
  if (tx.contract) {
    return callKind(tx.contract, networkKeyOf(chainId));
  }

  if (tx.method !== "transfer") {
    return "call";
  }

  return tx.txtype.toLowerCase() === "phoenix" ? "shielded" : "transfer";
}

export default transactionKind;
