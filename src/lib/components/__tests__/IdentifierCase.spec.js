import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";

import { gqlTransaction, hostProvisioners } from "$lib/mock-data";
import { transformTransaction } from "$lib/chain-info";

import { ProvisionersList, TransactionsList } from "..";

/** @param {string} path relative to this folder */
const readCss = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/*
 * Addresses and hashes are case-sensitive. The components' own styles,
 * which tests don't load by themselves, must show them as they are.
 */
describe("Identifier case", () => {
  /** @type {HTMLStyleElement} */
  let style;

  beforeEach(() => {
    style = document.createElement("style");
    style.textContent = [
      "../list-item/ListItem.css",
      "../provisioners-list/ProvisionersList.css",
      "../transactions-list/TransactionsList.css",
    ]
      .map(readCss)
      .join("\n");
    document.head.append(style);
  });

  afterEach(() => {
    cleanup();
    style.remove();
  });

  it("should keep the case of a provisioner's staking address", () => {
    const provisioner = {
      ...hostProvisioners[0],
      hasSeparateOwner: false,
      ownerAddress: hostProvisioners[0].key,
      ownerType: "Account",
      rank: 1,
    };
    const { container } = render(ProvisionersList, {
      props: { data: provisioner },
    });
    const address = /** @type {HTMLElement} */ (
      container.querySelector(".provisioners-list__staking-address")
    );

    expect(style.textContent).toContain(".provisioners-list");
    expect(address.textContent).toMatch(/[a-z]/);
    expect(getComputedStyle(address).textTransform).not.toBe("uppercase");
  });

  it("should keep the case of a transaction ID in the phone list", () => {
    const transaction = transformTransaction(gqlTransaction.tx);
    const { container } = render(TransactionsList, {
      props: { data: transaction },
    });
    const link = /** @type {HTMLElement} */ (
      container.querySelector(`a[href$="?id=${transaction.txid}"]`)
    );

    expect(link.textContent).toMatch(/[a-f]/);
    expect(getComputedStyle(link).textTransform).not.toBe("uppercase");
  });
});
