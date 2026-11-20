import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { globSync, readFileSync } from "node:fs";

import { gqlTransaction, hostProvisioners } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { ProvisionersList, TransactionsList } from "..";

/**
 * The `text-transform` an element's text shows with. It is inherited: the
 * nearest one set, on the element or above it, applies.
 *
 * @param {Element} element
 */
const textTransformOf = (element) => {
  let at = element;
  let transform = getComputedStyle(at).textTransform;

  while (!transform && at.parentElement) {
    at = at.parentElement;
    transform = getComputedStyle(at).textTransform;
  }

  return transform || "none";
};

/*
 * Dusk accounts are case-sensitive base58, and IDs are hashes: in another
 * case, an address reads as another, wrong account. The app's styles,
 * which tests don't load by themselves, must show them as they are.
 */
describe("Identifier case", () => {
  /** @type {HTMLStyleElement[]} */
  let sheets = [];

  beforeEach(() => {
    sheets = globSync("src/**/*.css").map((path) => {
      const sheet = document.createElement("style");

      sheet.textContent = readFileSync(path, "utf8");
      document.head.append(sheet);

      return sheet;
    });
  });

  afterEach(() => {
    cleanup();
    sheets.forEach((sheet) => sheet.remove());
  });

  it("should show a provisioner's staking address with no text-transform", () => {
    const [provisioner] = hostProvisioners;
    const { container } = render(ProvisionersList, {
      props: {
        data: {
          ...provisioner,
          hasSeparateOwner: false,
          ownerAddress: provisioner.key,
          ownerType: "Account",
          rank: 1,
        },
      },
    });

    expect(
      Array.from(
        container.querySelectorAll(".provisioners-list__staking-address"),
        textTransformOf,
      ),
    ).toStrictEqual(["none"]);
  });

  it("should show a transaction's accounts and ID with no text-transform", () => {
    const transaction = transformTransaction(gqlTransaction.tx);
    const { container } = render(TransactionsList, {
      props: { data: transaction },
    });

    expect(
      Array.from(
        container.querySelectorAll(
          `.transaction-party--account, a[href$="?id=${transaction.txid}"]`,
        ),
        textTransformOf,
      ),
    ).toStrictEqual(["none", "none", "none"]);
  });
});
