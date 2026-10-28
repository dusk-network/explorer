import { describe, expect, it } from "vitest";

import { duskEvmAddressUrl } from "..";

describe("duskEvmAddressUrl", () => {
  const address = "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01";

  it("should give an address's page on the DuskEVM explorer of the node's network", () => {
    expect(duskEvmAddressUrl(address, 2)).toBe(
      `https://explorer.testnet.evm.dusk.network/address/${address}`
    );
  });

  it("should give none where there is no DuskEVM: mainnet for now, and other networks", () => {
    expect(duskEvmAddressUrl(address, 1)).toBeNull();
    expect(duskEvmAddressUrl(address, 3)).toBeNull();
    expect(duskEvmAddressUrl(address, undefined)).toBeNull();
  });
});
