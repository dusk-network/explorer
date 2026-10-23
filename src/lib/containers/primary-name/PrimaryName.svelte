<script>
  import { AppAnchor } from "$lib/components";
  import { Anchor } from "$lib/dusk/components";
  import { middleEllipsis } from "$lib/dusk/string";
  import { getPrimaryName } from "$lib/dusk-domains";

  import "./PrimaryName.css";

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
    <span class="primary-name-group">
      {#if href}
        <AppAnchor className="primary-name" {href}>{found.name}</AppAnchor>
      {:else}
        <span class="primary-name">{found.name}</span>
      {/if}
      <Anchor
        aria-label="Open {found.name} on Dusk Domains"
        className="primary-name__site"
        data-tooltip-id="main-tooltip"
        data-tooltip-text="Open on Dusk Domains"
        href={found.url}>↗</Anchor
      >
      <span class="primary-name__address">{middleEllipsis(address, 6)}</span>
    </span>
  {:else}
    <slot />
  {/if}
{/await}
