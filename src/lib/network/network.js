import { labelFor, networkFor, networks } from "@dusk-network/networks";

/** @typedef {import("@dusk-network/networks").Network} Network */

/** The genesis contracts, at the same IDs on every network. */
export const { stake: STAKE_CONTRACT, transfer: TRANSFER_CONTRACT } =
  networks.mainnet.contracts;

/**
 * The node's network, as `@dusk-network/networks` gives it by the chain ID
 * the node says it is on: `null` until it says, and for a chain with no
 * network file, such as a local one.
 *
 * @param {number | null | undefined} chainId
 * @returns {Network | null}
 */
export const networkOf = (chainId) =>
  typeof chainId === "number" ? networkFor(chainId) : null;

/**
 * Whether the explorer's node has said which network it is on.
 *
 * @param {NodeInfo} nodeInfo
 */
export const isConnected = ({ chain_id: chainId }) =>
  Number.isInteger(chainId) || chainId === null;

/**
 * The name of the node's network: "Unknown" until it says, and "Localnet"
 * for a chain with no network file.
 *
 * @param {NodeInfo} nodeInfo
 * @returns {string}
 */
export const networkLabel = (nodeInfo) =>
  isConnected(nodeInfo)
    ? (networkOf(nodeInfo.chain_id)?.label ?? "Localnet")
    : "Unknown";

/**
 * Whether the node is on mainnet, the one network whose DUSK has a value.
 * Until it says, it isn't.
 *
 * @param {NodeInfo} nodeInfo
 */
export const isMainnet = (nodeInfo) =>
  networkOf(nodeInfo.chain_id)?.name === "mainnet";

/**
 * Whether the node is on a test network, whose DUSK has no value: any
 * network it says it is on but mainnet.
 *
 * @param {NodeInfo} nodeInfo
 */
export const isTestNetwork = (nodeInfo) =>
  isConnected(nodeInfo) && !isMainnet(nodeInfo);

/**
 * What the node's network calls a contract or an account, by its labels
 * in `@dusk-network/networks`, or `null`. Contracts others deployed are
 * named on their own network only; the genesis contracts on any, even
 * before the node says which it is on.
 *
 * @param {number | null | undefined} chainId
 * @param {string} id A contract ID, or an account's address
 * @returns {string | null}
 */
export function labelOf(chainId, id) {
  const network = networkOf(chainId);
  const label = network ? labelFor(network, id) : null;

  return (
    label ??
    (id === STAKE_CONTRACT || id === TRANSFER_CONTRACT
      ? labelFor(networks.mainnet, id)
      : null)
  );
}

/**
 * The DuskEVM bridge's contracts on a network: deposits to DuskEVM call the
 * bridge, and withdrawals back are proved and claimed at the portal. `null`
 * on a network with no DuskEVM.
 *
 * @param {Network | null} network
 * @returns {{ bridge: string, portal: string } | null}
 */
export function duskEvmBridgeOf(network) {
  const contracts = network?.duskEvm?.contracts;
  const bridge = contracts?.l1_standard_bridge?.contractId;
  const portal = contracts?.optimism_portal?.contractId;

  return bridge && portal ? { bridge, portal } : null;
}

/**
 * An address's page on the DuskEVM explorer of the node's network, or
 * `null` on a network with no DuskEVM.
 *
 * @param {string} address
 * @param {number | null | undefined} chainId The node's network
 * @returns {string | null}
 */
export function duskEvmAddressUrl(address, chainId) {
  const explorer = networkOf(chainId)?.duskEvm?.explorerUrl;

  return explorer ? `${explorer}/address/${address}` : null;
}
