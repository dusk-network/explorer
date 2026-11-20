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

  it("should show a provisioner's staking address as it is, with no text-transform", () => {
    const [provisioner] = hostProvisioners;
    const { key } = provisioner;
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
        (address) => [address.textContent?.trim(), textTransformOf(address)],
      ),
    ).toStrictEqual([[`${key.slice(0, 6)}…${key.slice(-6)}`, "none"]]);
  });

  it("should show a transaction's accounts and ID as they are, with no text-transform", () => {
    const transaction = transformTransaction(gqlTransaction.tx);
    const { txid } = transaction;
    const [sender, receiver] = [
      String(transaction.from),
      String(transaction.to),
    ];
    const { container } = render(TransactionsList, {
      props: { data: transaction },
    });

    expect(
      Array.from(
        container.querySelectorAll(
          `.transaction-party--account, a[href$="?id=${txid}"]`,
        ),
        (shown) => [shown.textContent?.trim(), textTransformOf(shown)],
      ),
    ).toStrictEqual([
      [`${sender.slice(0, 4)}…${sender.slice(-4)}`, "none"],
      [`${receiver.slice(0, 4)}…${receiver.slice(-4)}`, "none"],
      [
        expect.stringMatching(
          new RegExp(`(^| )${txid.slice(0, 6)}…${txid.slice(-6)}$`),
        ),
        "none",
      ],
    ]);
  });
});
