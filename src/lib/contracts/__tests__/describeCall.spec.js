import { describe, expect, it } from "vitest";
import { networks } from "@dusk-network/networks";

import { STAKE_CONTRACT, TRANSFER_CONTRACT } from "$lib/network";

import { describeCall } from "..";

describe("describeCall", () => {
  const duskDomainsStore =
    "33bd9ec8c70425f1a60c8a9e2fc860f15b822a3fcd2cf72b02b515a926de2b50";
  const unknown =
    "72883945ac1aa032000000000000000000000000000000000000000000000000";

  it("should name the genesis contracts", async () => {
    await expect(describeCall(TRANSFER_CONTRACT, "convert")).resolves.toEqual({
      label: null,
      name: "Transfer contract",
    });
    await expect(describeCall(STAKE_CONTRACT, "stake")).resolves.toEqual({
      label: null,
      name: "Stake contract",
    });
  });

  it("should say what a stake withdrawal does", async () => {
    await expect(describeCall(STAKE_CONTRACT, "withdraw")).resolves.toEqual({
      label: "Claim rewards",
      name: "Stake contract",
    });
  });

  it("should name Dusk Domains contracts and their common calls", async () => {
    await expect(
      describeCall(duskDomainsStore, "issue_reserved", 1)
    ).resolves.toEqual({ label: "Reserved name issued", name: "Dusk Domains" });
    await expect(describeCall(duskDomainsStore, "commit", 1)).resolves.toEqual({
      label: null,
      name: "Dusk Domains",
    });

    // Records replaced whole are a records change too.
    for (const method of ["mutate_records", "replace_records"]) {
      await expect(describeCall(duskDomainsStore, method, 1)).resolves.toEqual({
        label: "Records changed",
        name: "Dusk Domains",
      });
    }
  });

  it("should name Dusk Domains contracts on their own network only", async () => {
    // A mainnet contract, called on testnet, on a devnet, or before the
    // node has said which network it is on.
    for (const chainId of [2, 3, undefined]) {
      await expect(
        describeCall(duskDomainsStore, "issue_reserved", chainId)
      ).resolves.toEqual({ label: null, name: null });
    }
  });

  it("should know nothing of other contracts or inherited keys", async () => {
    await expect(describeCall(unknown, "register")).resolves.toEqual({
      label: null,
      name: null,
    });
    await expect(describeCall(STAKE_CONTRACT, "toString")).resolves.toEqual({
      label: null,
      name: "Stake contract",
    });
  });

  it("should name the DuskEVM bridge and its calls on testnet only", async () => {
    const bridge =
      "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";
    const portal =
      "14eeb3d4021aff09af2c515603a01f8d956a7f6411d11a1b1c0b0561a93fb1b9";

    await expect(
      describeCall(bridge, "depositETHToWithValue", 2)
    ).resolves.toEqual({ label: "Deposit to DuskEVM", name: "DuskEVM bridge" });
    await expect(
      describeCall(portal, "proveWithdrawalTransaction", 2)
    ).resolves.toEqual({
      label: "Prove withdrawal",
      name: "DuskEVM bridge portal",
    });
    await expect(
      describeCall(bridge, "depositETHToWithValue", 1)
    ).resolves.toEqual({ label: null, name: null });
    await expect(
      describeCall(bridge, "depositETHToWithValue")
    ).resolves.toEqual({ label: null, name: null });
  });

  it("should name Sozu's pool on its network", async () => {
    const mainnetPool =
      "6fdfdc713a18fc6ca2ad20eb2b4a3305a935ef47d6a872d9a4df8bc9fd9d169e";

    await expect(describeCall(mainnetPool, "sozu_stake", 1)).resolves.toEqual({
      label: "Liquid stake",
      name: "Sozu pool",
    });
    await expect(
      describeCall(mainnetPool, "stake_activate", 1)
    ).resolves.toEqual({ label: null, name: "Sozu pool" });
    await expect(describeCall(mainnetPool, "sozu_stake", 2)).resolves.toEqual({
      label: null,
      name: null,
    });
  });

  it("should name testnet's DuskEVM router and metadata registry, and Sozu's relayer", async () => {
    await expect(
      describeCall(
        "2e4b8b46390c860282b765641fa94037812601bf777164d7b7f801a262206046",
        "submit",
        2
      )
    ).resolves.toEqual({ label: null, name: "DuskEVM transaction router" });
    await expect(
      describeCall(
        "179f68303f0eb935660d52a52c2f104709d8b3b1d6f6525689d4d599695840c9",
        "registerBlobTxMeta",
        2
      )
    ).resolves.toEqual({ label: null, name: "DuskEVM transaction metadata" });
    await expect(
      describeCall(
        "51ced4fad52fc590def2736969c9e3e30013275a996c53714b81d8a08774aa37",
        "",
        2
      )
    ).resolves.toEqual({ label: null, name: "Sozu relayer" });
  });

  it("should name every contract by its network's label in @dusk-network/networks", async () => {
    for (const network of Object.values(networks)) {
      const contracts = Object.entries(network.display.labels).filter(([id]) =>
        /^[0-9a-f]{64}$/.test(id)
      );

      expect(contracts.length).toBeGreaterThan(1);

      for (const [id, label] of contracts) {
        await expect(
          describeCall(id, "", network.chainId)
        ).resolves.toMatchObject({ name: label });
      }
    }
  });
});
