import { describe, expect, it } from "vitest";

import { bridgeDepositRecipient } from "..";

describe("bridgeDepositRecipient", () => {
  const bridge =
    "2257e5f8ff49cf7c9704a14ca35acbf48eb7ade11a079d98d5cd5655eea1b31d";

  // A 0.5 DUSK deposit to DuskEVM on testnet, as the node gives it.
  const fnArgs = "AGXNHQAAAABaPY4bfC9Ka54NHD9ae5wtTm+KAUANAwDg////AAAAAA==";
  const deposit = /** @type {Transaction} */ (
    /** @type {unknown} */ ({
      amount: 0,
      contract: bridge,
      deposit: 500_000_000,
      method: "depositETHToWithValue",
      payload: {
        call: {
          contract: bridge,
          // eslint-disable-next-line camelcase
          fn_args: fnArgs,
          // eslint-disable-next-line camelcase
          fn_name: "depositETHToWithValue",
        },
      },
    })
  );

  it("should read the DuskEVM address a deposit pays, with its checksum", async () => {
    await expect(bridgeDepositRecipient(deposit, 2)).resolves.toBe(
      "0x5A3d8e1B7c2f4A6b9e0D1C3f5A7b9C2D4e6F8a01"
    );
  });

  it("should read nothing off the bridge's network, or from another call", async () => {
    await expect(bridgeDepositRecipient(deposit, 1)).resolves.toBeNull();
    await expect(
      bridgeDepositRecipient(deposit, undefined)
    ).resolves.toBeNull();
    await expect(
      bridgeDepositRecipient({ ...deposit, method: "deposit" }, 2)
    ).resolves.toBeNull();
    await expect(
      bridgeDepositRecipient({ ...deposit, contract: "00".repeat(32) }, 2)
    ).resolves.toBeNull();
  });

  it("should read nothing when the DUSK sent isn't the amount the call names, or the arguments aren't the bridge's", async () => {
    await expect(
      bridgeDepositRecipient({ ...deposit, deposit: 400_000_000 }, 2)
    ).resolves.toBeNull();
    await expect(
      bridgeDepositRecipient({ ...deposit, amount: 1 }, 2)
    ).resolves.toBeNull();

    /** @param {string} args */
    const withArgs = (args) => ({
      ...deposit,
      // eslint-disable-next-line camelcase
      payload: { call: { fn_args: args } },
    });

    // One byte short, and extra data that points past the root.
    const bytes = Uint8Array.from(atob(fnArgs), (c) => c.charCodeAt(0));
    const toBase64 = (/** @type {Uint8Array} */ b) =>
      btoa(String.fromCharCode(...b));
    const outOfBounds = bytes.slice();

    outOfBounds[36] = 1;

    await expect(
      bridgeDepositRecipient(
        /** @type {Transaction} */ (
          /** @type {unknown} */ (withArgs(toBase64(bytes.subarray(1))))
        ),
        2
      )
    ).resolves.toBeNull();
    await expect(
      bridgeDepositRecipient(
        /** @type {Transaction} */ (
          /** @type {unknown} */ (withArgs(toBase64(outOfBounds)))
        ),
        2
      )
    ).resolves.toBeNull();
    await expect(
      bridgeDepositRecipient(
        /** @type {Transaction} */ (
          /** @type {unknown} */ (withArgs("not base64!"))
        ),
        2
      )
    ).resolves.toBeNull();
  });
});
