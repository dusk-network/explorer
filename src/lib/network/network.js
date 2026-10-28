/** The chain ID of mainnet, the one network whose DUSK has a value. */
export const MAINNET_CHAIN_ID = 1;

/**
 * Whether the explorer's node has said which network it is on.
 *
 * @param {NodeInfo} nodeInfo
 */
export const isConnected = ({ chain_id: chainId }) =>
  Number.isInteger(chainId) || chainId === null;

/**
 * The name of the node's network, lowercase.
 *
 * @param {NodeInfo} nodeInfo
 * @returns {string}
 */
export function getNetworkName(nodeInfo) {
  if (!isConnected(nodeInfo)) {
    return "unknown";
  }

  switch (nodeInfo.chain_id) {
    case MAINNET_CHAIN_ID:
      return "mainnet";

    case 2:
      return "testnet";

    case 3:
      return "devnet";

    case 41:
      return "mainnet dry-run #2";

    default:
      return "localnet";
  }
}

/**
 * Whether the node is on mainnet. Until it says, it isn't.
 *
 * @param {NodeInfo} nodeInfo
 */
export const isMainnet = (nodeInfo) => nodeInfo.chain_id === MAINNET_CHAIN_ID;

/**
 * Whether the node is on a test network, whose DUSK has no value: any
 * known network but mainnet.
 *
 * @param {NodeInfo} nodeInfo
 */
export const isTestNetwork = (nodeInfo) =>
  isConnected(nodeInfo) && !isMainnet(nodeInfo);
