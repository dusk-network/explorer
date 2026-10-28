/**
 * Contracts others deployed that the explorer names, by network. Their
 * IDs are the ones the bridge and the wallets use.
 */

/**
 * The DuskEVM bridge's contracts: deposits to DuskEVM call the bridge, and
 * withdrawals back are proved and claimed at the portal. Mainnet has no
 * bridge yet. The explorer is DuskEVM's own, where an address has a page at
 * `/address/<address>`.
 *
 * @type {Record<string, { bridge: string, explorer: string, portal: string } | undefined>}
 */
export const DUSKEVM_BRIDGE_CONTRACTS = {
  mainnet: undefined,
  testnet: {
    bridge: "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d",
    explorer: "https://explorer.testnet.evm.dusk.network",
    portal: "14eeb3d4021aff09af2c515603a01f8d956a7f6411d11a1b1c0b0561a93fb1b9",
  },
};

/**
 * Sozu's liquid staking: its hub, and the pool people stake with.
 *
 * @type {Record<string, { hub: string, pool: string }>}
 */
export const SOZU_CONTRACTS = {
  mainnet: {
    hub: "b32c917e76abc6fcf2edbee0fa70231d8e19c405b18421794a11badfc66d2f26",
    pool: "6fdfdc713a18fc6ca2ad20eb2b4a3305a935ef47d6a872d9a4df8bc9fd9d169e",
  },
  testnet: {
    hub: "bae85f8c24730a5a19fbe3d3bd58248ac8c302b62fe414a8c640d8c0ed286b9e",
    pool: "72883945ac1aa032a88543aacc9e358d1dfef07717094c05296ce675f23078f2",
  },
};

/**
 * An address's page on the DuskEVM explorer of the node's network, or
 * `null` off the networks with a DuskEVM.
 *
 * @param {string} address
 * @param {number | null | undefined} chainId The node's network
 * @returns {string | null}
 */
export function duskEvmAddressUrl(address, chainId) {
  const network = networkKeyOf(chainId);
  const explorer = network
    ? DUSKEVM_BRIDGE_CONTRACTS[network]?.explorer
    : undefined;

  return explorer ? `${explorer}/address/${address}` : null;
}

/**
 * Mainnet or testnet, by the node's chain ID, or `null` for any other.
 *
 * @param {number | null | undefined} chainId
 * @returns {"mainnet" | "testnet" | null}
 */
export const networkKeyOf = (chainId) =>
  chainId === 1 ? "mainnet" : chainId === 2 ? "testnet" : null;
