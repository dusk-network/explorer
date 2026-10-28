import { writable } from "svelte/store";

import { accountsOf } from "$lib/chain-info";
import { getPrimaryNames } from "$lib/dusk-domains";

/**
 * The verified primary names of the accounts a list of transactions shows,
 * as a store: one lookup for all of them, which Multicall for Dusk carries
 * in one query, and none for an account already looked up this session.
 * Each answer adds to the names known, so one that comes late takes none
 * away.
 *
 * @returns {import("svelte/store").Readable<Map<string, { name: string, url: string } | null>> & {
 *   lookUp: (shown: Transaction[]) => void,
 * }}
 */
export default function createNamesStore() {
  /** @type {import("svelte/store").Writable<Map<string, { name: string, url: string } | null>>} */
  const { subscribe, update } = writable(new Map());

  return {
    lookUp(shown) {
      getPrimaryNames(accountsOf(shown)).then((found) => {
        update((known) => new Map([...known, ...found]));
      });
    },
    subscribe,
  };
}
