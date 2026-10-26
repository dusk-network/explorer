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

  // The name is optional: the slot shows the address while it loads,
  // and if there is no name or the lookup fails.
  $: primaryName = getPrimaryName(address).catch(() => null);
</script>

{#await primaryName}
  <slot />
{:then found}
  {#if found}
    <DuskName {address} {href} name={found} />
  {:else}
    <slot />
  {/if}
{/await}
