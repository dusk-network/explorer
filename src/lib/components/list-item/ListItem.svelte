<svelte:options immutable={true} />

<script context="module">
  let helpCount = 0;
</script>

<script>
  import { Icon } from "$lib/dusk/components";
  import { mdiInformationOutline } from "@mdi/js";
  import { getContext, onMount } from "svelte";
  import contexts from "$lib/contexts";

  import "./ListItem.css";

  /** @type {string} */
  export let tooltipText = "";

  /**
   * A long value, as an address or a hash: it goes under its label, across
   * the list, instead of beside it.
   *
   * @type {boolean}
   */
  export let wide = false;

  const context = getContext("DUSK:list-item:context") || "";
  const helpId = `list-item-help-${++helpCount}`;

  /** @type {HTMLDivElement} */
  let layout;

  /** @type {HTMLButtonElement | undefined} */
  let help;

  /** The help's name, from its row's term: "About gas price". */
  let helpName = "More information";

  onMount(() => {
    const term = Array.from(layout.childNodes, (node) =>
      node === help ? "" : node.textContent
    )
      .join("")
      .trim();

    if (term) {
      helpName = `About ${term.toLowerCase()}`;
    }
  });
</script>

<dt
  class="details-list__term"
  class:details-list__term--table={context === contexts.LIST_ITEM.DETAIL_LIST}
  class:details-list__term--wide={wide}
>
  <div bind:this={layout} class="details-list__term-layout">
    {#if tooltipText}
      <!-- The help shows on hover, on focus and on a tap. -->
      <button
        bind:this={help}
        aria-describedby={helpId}
        aria-label={helpName}
        class="detail-list__help"
        data-tooltip-id="main-tooltip"
        data-tooltip-place="top"
        data-tooltip-text={tooltipText}
        data-tooltip-type="info"
        type="button"
      >
        <Icon path={mdiInformationOutline} size="default" />
        <span hidden id={helpId}>{tooltipText}</span>
      </button>
    {/if}
    <slot name="term" />
  </div>
</dt>
<dd
  class="details-list__definition"
  class:details-list__definition--table={context ===
    contexts.LIST_ITEM.DETAIL_LIST}
  class:details-list__definition--wide={wide}
>
  <slot name="definition" />
</dd>
