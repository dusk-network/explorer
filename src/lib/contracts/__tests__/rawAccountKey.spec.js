import { describe, expect, it } from "vitest";

import * as base58 from "$lib/utils/encoders/base58";

import { rawAccountKey } from "../rawAccountKey";

/** @param {Uint8Array} bytes */
const toHex = (bytes) => Buffer.from(bytes).toString("hex");

/** @param {string} address */
const keyOf = (address) => Uint8Array.from(base58.decode(address) ?? []);

/**
 * Testnet accounts and `balance_of`'s argument for them, as Sozu's stDUSK
 * data driver encodes it: the `Account::External` tag, 1, then the raw key.
 * The first sorts its y as the smaller root, the second as the larger.
 */
const vectors = [
  [
    "qxwSidLBa1rJ74ngfP4GUCaNsAYjMboDPHzbmiVEMmNNK26hVkYe8QccH6ipYdVRsUDnx9QS1KBeu8ZoMDFpXJJE6YCcHy2AykvJ7eEAGc7PGDgCZFV5YJBxzukADkQ2Bgr",
    "017de9fd978ecfba13d6e3e50a66e183ec04b9fd33eda7fefa60e0a2e731ade06946836da658f9583e122c49877ec8fe186ca73fbfa8325345f95624c7d6421403a92783ebfb77f59353179aabcec54d853b4da3116032525096ced451a6899f081c28a0bd0ee4fc5a5500f55cdc73aa9a7bdb0a6cf7862a79d7415376ed909044bc813180b9d2f883416bdaa8264d2c15c9f681614322403cd49c3b3cdc3244eda993d911eae2e9297560d02e180e3ffb56a7748c298b7bf0874eaf867e73660400",
  ],
  [
    "21n5ncyuJkRr9JRoxvWRLMcqcWxmVSSLdefDMTwQeNyZZikU5dcXuawf9kNuG1CxFvz32oBM965PQ2PCcWrwX8YX9a7fqaaQ6fabDhxW5mveEyAt4LgdY3KLH9iKtSfMMLNz",
    "016717a02bc6933ffe261f47a3b239e4b323d7d73149c3e24e442939bd297a6572ecf635f40eeac8f37f2f06d605da970a32c128aa29b671b5368038ed4cb53e7a150275675add2045271410e4f0f2b4a9ed192a1d9691aa7a3efdb8f6798bbf030117554df0051bd2b65e8dce5547b56cd1993be64590b6a4b61dd8c275c87de0d22667291264984fcf1546dcb8d8c800830edc4a813bd9d3c3822bec934d8a22ee3898d3256d4fa67bb0a71879d0fc9f7c5442293ecbbf9ded9475428e114d0400",
  ],
];

describe("rawAccountKey", () => {
  it("should give an address's key as Sozu's data driver encodes it", () => {
    for (const [address, args] of vectors) {
      const raw = rawAccountKey(keyOf(address));

      expect(raw).toHaveLength(193);
      expect(`01${toHex(/** @type {Uint8Array} */ (raw))}`).toBe(args);
    }
  });

  it("should give nothing for bytes that aren't a compressed key of a point", () => {
    const key = keyOf(vectors[0][0]);

    /** @param {(bytes: Uint8Array) => void} change */
    const changed = (change) => {
      const bytes = Uint8Array.from(key);

      change(bytes);

      return bytes;
    };

    // Not 96 bytes.
    expect(rawAccountKey(key.subarray(0, 95))).toBeNull();
    // Not marked compressed.
    expect(
      rawAccountKey(
        changed((bytes) => {
          bytes[0] &= 0x7f;
        })
      )
    ).toBeNull();
    // The identity.
    expect(
      rawAccountKey(
        changed((bytes) => {
          bytes[0] |= 0x40;
        })
      )
    ).toBeNull();
    // A coordinate at or over the field's modulus.
    expect(rawAccountKey(changed((bytes) => bytes.fill(0xff, 1)))).toBeNull();
    // x = 1, which no point on the curve has.
    expect(
      rawAccountKey(
        changed((bytes) => {
          bytes[0] &= 0xe0;
          bytes.fill(0, 1);
          bytes[95] = 1;
        })
      )
    ).toBeNull();
  });
});
