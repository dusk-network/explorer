<script>
  import { Anchor } from "$lib/dusk/components";
  import { getPrimaryName } from "$lib/dusk-domains";

  import "./PrimaryName.css";

  /** @type {string} */
  export let address;

  // The name is optional: show nothing while it loads or if the lookup fails.
  $: primaryName = getPrimaryName(address).catch(() => null);
</script>

{#await primaryName then found}
  {#if found}
    <Anchor
      className="primary-name"
      data-tooltip-id="main-tooltip"
      data-tooltip-text="Primary name on Dusk Domains"
      href={found.url}>{found.name}</Anchor
    >
  {/if}
{/await}
