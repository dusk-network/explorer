<script>
  import { AppAnchor } from "$lib/components";
  import { Anchor } from "$lib/dusk/components";

  import "./DuskName.css";

  /**
   * A `.dusk` name and its page on the Dusk Domains site.
   *
   * @type {{ name: string, url: string }}
   */
  export let name;

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
    <AppAnchor className="primary-name chain-link" {href}>{name.name}</AppAnchor
    >
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
</span>
