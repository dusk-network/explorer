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

  /**
   * The account's verified primary name, shown instead of its address.
   *
   * @type {{ name: string, url: string } | null | undefined}
   */
  export let name = undefined;

  $: contractName =
    party?.kind === "contract"
      ? describeCall(party.id, "").then((call) => call.name)
      : Promise.resolve(null);
</script>

{#if party?.kind === "account" && name}
  <AppAnchor
    className="transaction-party transaction-party--named"
    data-tooltip-id="main-tooltip"
    data-tooltip-text="{name.name} · {middleEllipsis(party.address, chars)}"
    href="/accounts/?key={party.address}">{name.name}</AppAnchor
  >
{:else if party?.kind === "account"}
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
    >{#await contractName}{shortId}{:then known}{known ?? shortId}{/await}</span
  >
{:else if party?.kind === "shielded"}
  <span class="transaction-party transaction-party--hidden">Shielded</span>
{:else}
  <span class="transaction-party transaction-party--hidden">- - -</span>
{/if}
