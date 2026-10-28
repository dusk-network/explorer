<svelte:options immutable={true} />

<script>
  import { mdiArrowLeft, mdiArrowRight, mdiCubeOutline } from "@mdi/js";
  import {
    AppAnchorButton,
    DataCard,
    FullValue,
    ListItem,
  } from "$lib/components";
  import { CopyButton, Icon, ProgressBar, Switch } from "$lib/dusk/components";
  import { formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import { createValueFormatter } from "$lib/dusk/value";
  import { makeClassName } from "$lib/dusk/string";
  import "./BlockDetails.css";

  /** @type {string | Undefined} */
  export let className = undefined;

  /** @type {Block} */
  export let data;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {String | null} */
  export let payload;

  const formatter = createValueFormatter("en");

  /** @type {Boolean} */
  let isPayloadToggled = false;

  $: classes = makeClassName(["block-details", "detail-page", className]);
  $: count = data ? data.transactions.data.length : 0;
  $: ({ gasLimit, gasUsed } = data
    ? data.transactions.stats
    : { gasLimit: 0, gasUsed: 0 });
</script>

<DataCard
  on:retry
  {data}
  {error}
  {loading}
  className={classes}
  title="Block"
  variant="detail"
>
  <!-- The block's height, when it came and what it holds; the blocks beside it. -->
  <div class="block-details__summary detail-summary">
    <span aria-hidden="true" class="row-icon"
      ><Icon path={mdiCubeOutline} /></span
    >
    <p class="block-details__summary-lines detail-summary__lines">
      <span class="block-details__summary-text detail-summary__text"
        >Block {formatter(data.header.height)}</span
      >
      <span class="block-details__summary-meta detail-summary__meta">
        {formatDateTime(data.header.date)}
        <span aria-hidden="true">·</span>
        {formatter(count)}
        {count === 1 ? "transaction" : "transactions"}
      </span>
    </p>
    <nav aria-label="Blocks beside it" class="block-details__nav">
      <AppAnchorButton
        aria-label="Previous block"
        className="block-details__list-anchor"
        href="/blocks/block?id={data.header.prevblockhash}"
        icon={{ path: mdiArrowLeft }}
        disabled={!data.header.prevblockhash || data.header.height === 0}
        variant="secondary"
      />
      <AppAnchorButton
        aria-label="Next block"
        className="block-details__list-anchor"
        href="/blocks/block?id={data.header.nextblockhash}"
        icon={{ path: mdiArrowRight }}
        disabled={!data.header.nextblockhash}
        variant="secondary"
      />
    </nav>
  </div>

  <dl class="block-details__list detail-rows">
    <!-- BLOCK HASH -->
    <ListItem wide>
      <svelte:fragment slot="term">Hash</svelte:fragment>
      <svelte:fragment slot="definition">
        <FullValue value={data.header.hash} />
        <CopyButton
          name="Block hash"
          rawValue={data.header.hash}
          text="Copy"
          variant="secondary"
        />
      </svelte:fragment>
    </ListItem>

    <!-- BLOCK REWARD -->
    <ListItem
      tooltipText="The reward allocated to the block generator can fluctuate between 70-80% of the total reward and the flexible 10% can end up being burnt if there's no unanimous vote on a block"
    >
      <svelte:fragment slot="term">Block reward</svelte:fragment>
      <svelte:fragment slot="definition"
        >{formatDuskExact(data.header.reward)} DUSK</svelte:fragment
      >
    </ListItem>

    <!-- BLOCK FEES PAID -->
    <ListItem>
      <svelte:fragment slot="term">Block fees paid</svelte:fragment>
      <svelte:fragment slot="definition"
        >{formatDuskExact(data.header.feespaid)} DUSK</svelte:fragment
      >
    </ListItem>

    <!-- GAS USED, OF THE BLOCK'S LIMIT -->
    <ListItem
      tooltipText="The gas the block's transactions used, of the most a block can hold"
    >
      <svelte:fragment slot="term">Gas used</svelte:fragment>
      <svelte:fragment slot="definition">
        {formatter(gasUsed)} of {formatter(gasLimit)}
        <ProgressBar
          currentPercentage={gasLimit === 0 ? 0 : (gasUsed / gasLimit) * 100}
          className="block-details__gas-used"
          ariaLabel="Gas Used"
        />
      </svelte:fragment>
    </ListItem>

    <!-- AVERAGE GAS PRICE -->
    <ListItem>
      <svelte:fragment slot="term">Average gas price</svelte:fragment>
      <svelte:fragment slot="definition"
        >{formatter(data.transactions.stats.averageGasPrice)} LUX</svelte:fragment
      >
    </ListItem>
  </dl>

  <!-- The state root and the raw header, for those who want them. -->
  <details class="block-details__technical detail-technical">
    <summary class="block-details__technical-summary detail-technical__summary"
      >Technical details</summary
    >
    <dl class="block-details__list detail-rows">
      <!-- STATE ROOT HASH -->
      <ListItem wide>
        <svelte:fragment slot="term">State root hash</svelte:fragment>
        <svelte:fragment slot="definition">
          <FullValue value={data.header.statehash} />
          <CopyButton
            name="State root hash"
            rawValue={data.header.statehash}
            text="Copy"
            variant="secondary"
          />
        </svelte:fragment>
      </ListItem>

      <!-- HEADER -->
      <ListItem wide>
        <svelte:fragment slot="term">
          <span class="block-details__switch-wrapper detail-switch">
            Header
            <Switch
              aria-label="Show block header"
              className="block-details__payload-switch"
              onSurface={true}
              bind:value={isPayloadToggled}
            />
          </span>
        </svelte:fragment>

        <svelte:fragment slot="definition">
          {#if isPayloadToggled}
            <pre class="block-details__payload detail-payload">{payload
                ? JSON.stringify(JSON.parse(payload), null, 2)
                : "—"}</pre>
          {/if}
        </svelte:fragment>
      </ListItem>
    </dl>
  </details>
</DataCard>
