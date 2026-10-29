import { describe, expect, it } from "vitest";
import { networks } from "@dusk-network/networks";

import { apiNodeInfo } from "$lib/mock-data";

import {
  STAKE_CONTRACT,
  TRANSFER_CONTRACT,
  duskEvmAddressUrl,
  isMainnet,
  isTestNetwork,
  labelOf,
  networkLabel,
  networkOf,
} from "..";

/** @param {number | null | undefined} chainId */
// eslint-disable-next-line camelcase
const nodeOn = (chainId) => ({ ...apiNodeInfo, chain_id: chainId });

describe("network", () => {
  it("should find the node's network in @dusk-network/networks by its chain ID", () => {
    expect(networkOf(1)).toBe(networks.mainnet);
    expect(networkOf(2)).toBe(networks.testnet);
    expect(networkOf(3)).toBe(networks.devnet);

    // A local chain, and a node that hasn't said yet.
    for (const chainId of [0, 41, null, undefined]) {
      expect(networkOf(chainId)).toBeNull();
    }
  });

  it("should name the node's network, a local one, or none until the node says", () => {
    expect(networkLabel(nodeOn(1))).toBe("Mainnet");
    expect(networkLabel(nodeOn(2))).toBe("Testnet");
    expect(networkLabel(nodeOn(3))).toBe("Devnet");
    expect(networkLabel(nodeOn(0))).toBe("Localnet");
    expect(networkLabel(nodeOn(undefined))).toBe("Unknown");
  });

  it("should count any network the node says it is on but mainnet as a test network", () => {
    expect(isMainnet(nodeOn(1))).toBe(true);
    expect(isTestNetwork(nodeOn(1))).toBe(false);

    for (const chainId of [0, 2, 3]) {
      expect(isMainnet(nodeOn(chainId))).toBe(false);
      expect(isTestNetwork(nodeOn(chainId))).toBe(true);
    }

    expect(isMainnet(nodeOn(undefined))).toBe(false);
    expect(isTestNetwork(nodeOn(undefined))).toBe(false);
  });

  it("should name a contract or an account by its network's labels, on that network only", () => {
    const relayer =
      "51ced4fad52fc590def2736969c9e3e30013275a996c53714b81d8a08774aa37";
    const bscBridge =
      "24jFms4JqYdWb19jFn3CUjNUQz1AeRozYnwsHuUkLbXAj2gRBq598aLAJmqmsaPcsCNJTgTaJTaUZCXpT3s9UeWBsHTmd5hQx95JymZSUsmtwoibiB8AMp4bZjAiLMjmAH3x";

    expect(labelOf(2, relayer)).toBe("Sozu relayer");
    expect(labelOf(1, relayer)).toBeNull();
    expect(labelOf(1, bscBridge)).toBe("BSC bridge");
    expect(labelOf(2, bscBridge)).toBeNull();
    expect(labelOf(2, "toString")).toBeNull();
  });

  it("should name the genesis contracts on any network, even before the node says which", () => {
    for (const chainId of [0, undefined]) {
      expect(labelOf(chainId, STAKE_CONTRACT)).toBe("Stake contract");
      expect(labelOf(chainId, TRANSFER_CONTRACT)).toBe("Transfer contract");
    }
  });

  it("should give an address's page on the DuskEVM explorer of the node's network", () => {
    const address = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";

    expect(duskEvmAddressUrl(address, 2)).toBe(
      `${networks.testnet.duskEvm?.explorerUrl}/address/${address}`
    );
    expect(duskEvmAddressUrl(address, 2)).toBe(
      `https://explorer.testnet.evm.dusk.network/address/${address}`
    );

    // None where there is no DuskEVM: mainnet for now, and other networks.
    for (const chainId of [1, 3, undefined]) {
      expect(duskEvmAddressUrl(address, chainId)).toBeNull();
    }
  });
});
