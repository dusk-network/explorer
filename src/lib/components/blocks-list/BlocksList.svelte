<svelte:options immutable={true} />

<script>
  import { mdiCubeOutline } from "@mdi/js";

  import { AppAnchor } from "$lib/components";
  import { Icon, RelativeTime } from "$lib/dusk/components";
  import { createValueFormatter } from "$lib/dusk/value";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import "./BlocksList.css";

  /** @type {Block} */
  export let data;

  const formatter = createValueFormatter("en");

  $: count = data.transactions.data.length;
</script>

<!--
  A block as a row of the web wallet's History on a phone: its height and
  when, its reward and how many transactions it holds. The height is the
  link to the block, and the whole row opens it.
-->
<div class="block-row">
  <span aria-hidden="true" class="row-icon"><Icon path={mdiCubeOutline} /></span
  >
  <div class="block-row__main">
    <AppAnchor
      aria-label="Block {formatter(data.header.height)}"
      className="block-row__link chain-link"
      href={`/blocks/block?id=${data.header.hash}`}
      >{formatter(data.header.height)}</AppAnchor
    >
    <span class="row-line">
      <RelativeTime
        autoRefresh
        className="block-row__time"
        data-tooltip-id="main-tooltip"
        data-tooltip-text={formatDateTime(data.header.date)}
        date={data.header.date}
      />
    </span>
  </div>
  <div class="block-row__end">
    <span class="row-amount"
      ><span title="{formatDuskExact(data.header.reward)} DUSK"
        >{formatDusk(data.header.reward)}</span
      >
      <span class="row-unit">DUSK</span></span
    >
    <span class="row-line"
      >{formatter(count)}
      {count === 1 ? "transaction" : "transactions"}</span
    >
  </div>
</div>
