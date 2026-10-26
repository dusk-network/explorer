import { describe, expect, it } from "vitest";

import { STAKE_CONTRACT, TRANSFER_CONTRACT, describeCall } from "..";

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
      describeCall(duskDomainsStore, "issue_reserved")
    ).resolves.toEqual({ label: "Reserved name issued", name: "Dusk Domains" });
    await expect(describeCall(duskDomainsStore, "commit")).resolves.toEqual({
      label: null,
      name: "Dusk Domains",
    });
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
});
