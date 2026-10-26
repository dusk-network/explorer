<svelte:options immutable={true} />

<script context="module">
  let helpCount = 0;
</script>

<script>
  import { Icon } from "$lib/dusk/components";
  import { mdiInformationOutline } from "@mdi/js";
  import { getContext } from "svelte";
  import contexts from "$lib/contexts";

  import "./ListItem.css";

  /** @type {string} */
  export let tooltipText = "";

  const context = getContext("DUSK:list-item:context") || "";
  const helpId = `list-item-help-${++helpCount}`;
</script>

<dt
  class="details-list__term"
  class:details-list__term--table={context === contexts.LIST_ITEM.DETAIL_LIST}
>
  <div class="details-list__term-layout">
    {#if tooltipText}
      <!-- The help shows on hover, on focus and on a tap. -->
      <button
        aria-describedby={helpId}
        aria-label="More information"
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
>
  <slot name="definition" />
</dd>
