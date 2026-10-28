<svelte:options immutable={true} />

<script>
  import { AppAnchor } from "$lib/components";
  import { describeCall } from "$lib/contracts";
  import { middleEllipsis } from "$lib/dusk/string";

  import "./TransactionParty.css";

  /**
   * A transaction's sender or receiver, as `summarizeTransaction` gives it.
   *
   * @type {import("$lib/chain-info/summarizeTransaction").TransactionParty | null}
   */
  export let party;

  /**
   * How many characters of an address to show on each side of the ellipsis.
   *
   * @type {number}
   */
  export let chars = 6;

  $: contractName =
    party?.kind === "contract"
      ? describeCall(party.id, "").then(({ name }) => name)
      : Promise.resolve(null);
</script>

{#if party?.kind === "account"}
  <AppAnchor
    className="transaction-party transaction-party--account"
    href="/accounts/?key={party.address}"
    >{middleEllipsis(party.address, chars)}</AppAnchor
  >
{:else if party?.kind === "contract"}
  {@const shortId = `Contract ${middleEllipsis(party.id, 4)}`}
  <span
    class="transaction-party transaction-party--contract"
    data-tooltip-id="main-tooltip"
    data-tooltip-text="Contract {party.id}"
    >{#await contractName}{shortId}{:then name}{name ?? shortId}{/await}</span
  >
{:else if party?.kind === "shielded"}
  <span class="transaction-party transaction-party--hidden">Shielded</span>
{:else}
  <span class="transaction-party transaction-party--hidden">- - -</span>
{/if}
