<script>
  import { AppAnchor } from "$lib/components";
  import { Anchor } from "$lib/dusk/components";
  import { middleEllipsis } from "$lib/dusk/string";

  import "./DuskName.css";

  /**
   * A `.dusk` name and its page on the Dusk Domains site.
   *
   * @type {{ name: string, url: string }}
   */
  export let name;

  /**
   * The account the name points to, shown short after the name.
   *
   * @type {string | undefined}
   */
  export let address = undefined;

  /**
   * The account's page in the explorer, to link the name to.
   * Without it, the name is plain text.
   *
   * @type {string | undefined}
   */
  export let href = undefined;
</script>

<span class="primary-name-group">
  {#if href}
    <AppAnchor className="primary-name" {href}>{name.name}</AppAnchor>
  {:else}
    <span class="primary-name">{name.name}</span>
  {/if}
  <Anchor
    aria-label="Open {name.name} on Dusk Domains"
    className="primary-name__site"
    data-tooltip-id="main-tooltip"
    data-tooltip-text="Open on Dusk Domains"
    href={name.url}>↗</Anchor
  >
  {#if address}
    <span class="primary-name__address">{middleEllipsis(address, 6)}</span>
  {/if}
</span>
