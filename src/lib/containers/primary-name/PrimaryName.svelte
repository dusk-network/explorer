<script>
  import { DuskName } from "$lib/components";
  import { getPrimaryName } from "$lib/dusk-domains";

  /** @type {string} */
  export let address;

  /**
   * The account's page in the explorer, to link the name to.
   * Without it, the name is plain text.
   *
   * @type {string | undefined}
   */
  export let href = undefined;

  /**
   * Whether the name shows the address short after it. A page that shows
   * the address in full beside the name leaves it out.
   */
  export let showAddress = true;

  // The name is optional: the slot shows the address while it loads,
  // and if there is no name or the lookup fails.
  $: primaryName = getPrimaryName(address).catch(() => null);
</script>

{#await primaryName}
  <slot />
{:then found}
  {#if found}
    <DuskName address={showAddress ? address : undefined} {href} name={found} />
  {:else}
    <slot />
  {/if}
{/await}
