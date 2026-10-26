<svelte:options immutable={true} />

<script>
  import { onMount } from "svelte";
  import { CopyButton, RelativeTime } from "$lib/dusk/components";
  import { calculateAdaptiveCharCount, middleEllipsis } from "$lib/dusk/string";
  import { createFeeFormatter, luxToDusk } from "$lib/dusk/currency";
  import { summarizeTransaction } from "$lib/chain-info";
  import {
    AppAnchor,
    DataGuard,
    DetailList,
    ListItem,
    TransactionParty,
    TransactionStatus,
    TransactionType,
  } from "$lib/components";
  import { addressCharPropertiesDefaults } from "$lib/constants";

  import "./TransactionsList.css";

  /** @type {boolean} */
  export let autoRefreshTime = false;

  /** @type {Transaction}*/
  export let data;

  /** @type {Boolean} */
  export let displayTooltips = false;

  /** @type {"compact" | "full"} */
  export let mode;

  /** @type {number} */
  let screenWidth = window.innerWidth;

  const duskFormatter = createFeeFormatter("en");

  const { minScreenWidth, maxScreenWidth, minCharCount, maxCharCount } =
    addressCharPropertiesDefaults;

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      screenWidth = entry.contentRect.width;
    });

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  });

  $: ({ amount, from, to } = summarizeTransaction(data));
</script>

<DetailList>
  <!-- TRANSACTION ID -->
  <ListItem tooltipText={displayTooltips ? "The ID of the transaction" : ""}>
    <svelte:fragment slot="term">ID</svelte:fragment>
    <svelte:fragment slot="definition">
      <AppAnchor
        className="transaction-details__list-link"
        href={`/transactions/transaction?id=${data.txid}`}
        >{middleEllipsis(
          data.txid,
          calculateAdaptiveCharCount(
            screenWidth,
            minScreenWidth,
            maxScreenWidth,
            minCharCount,
            maxCharCount
          )
        )}</AppAnchor
      >
      <CopyButton
        name="Transaction ID"
        rawValue={data.txid}
        variant="secondary"
      />
    </svelte:fragment>
  </ListItem>

  <!-- TIMESTAMP -->
  <ListItem
    tooltipText={displayTooltips
      ? "Time elapsed since the transaction was created"
      : ""}
  >
    <svelte:fragment slot="term">relative time</svelte:fragment>
    <RelativeTime
      autoRefresh={autoRefreshTime}
      data-tooltip-id="main-tooltip"
      data-tooltip-text={data.date.toUTCString()}
      date={data.date}
      className="transaction-details__list-timestamp"
      slot="definition"
    />
  </ListItem>

  <!-- FROM -->
  <ListItem
    tooltipText={displayTooltips ? "The sender of the transaction" : ""}
  >
    <svelte:fragment slot="term">From</svelte:fragment>
    <svelte:fragment slot="definition">
      <TransactionParty party={from} />
    </svelte:fragment>
  </ListItem>

  <!-- TO -->
  <ListItem
    tooltipText={displayTooltips
      ? "The receiver of the transaction, or the contract it called"
      : ""}
  >
    <svelte:fragment slot="term">To</svelte:fragment>
    <svelte:fragment slot="definition">
      <TransactionParty party={to} />
    </svelte:fragment>
  </ListItem>

  <!-- AMOUNT -->
  <ListItem
    tooltipText={displayTooltips
      ? "The DUSK sent to the receiver, or to the contract it called"
      : ""}
  >
    <svelte:fragment slot="term">Amount</svelte:fragment>
    <svelte:fragment slot="definition">
      {#if amount.kind === "shielded"}
        Shielded
      {:else}
        {duskFormatter(luxToDusk(amount.lux))} DUSK
      {/if}
    </svelte:fragment>
  </ListItem>

  {#if mode === "full"}
    <!-- TX FEE -->
    <ListItem tooltipText={displayTooltips ? "The transaction fee amount" : ""}>
      <svelte:fragment slot="term">Fee</svelte:fragment>
      <svelte:fragment slot="definition">
        {duskFormatter(luxToDusk(data.feepaid))} DUSK
      </svelte:fragment>
    </ListItem>
  {/if}

  <!-- STATUS -->
  <ListItem tooltipText={displayTooltips ? "The transaction status" : ""}>
    <svelte:fragment slot="term">Status</svelte:fragment>
    <svelte:fragment slot="definition">
      <TransactionStatus
        className="explorer-badge"
        errorMessage={data.txerror}
        showErrorTooltip={autoRefreshTime}
      />
    </svelte:fragment>
  </ListItem>

  <!-- TYPE -->
  <ListItem tooltipText={displayTooltips ? "The transaction type" : ""}>
    <svelte:fragment slot="term">Type</svelte:fragment>
    <svelte:fragment slot="definition"
      ><DataGuard data={data.method && data.txtype}>
        <TransactionType {data} {displayTooltips} showPrivacy={false} />
      </DataGuard></svelte:fragment
    >
  </ListItem>
</DetailList>
