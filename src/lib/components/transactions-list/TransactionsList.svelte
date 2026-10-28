<svelte:options immutable={true} />

<script>
  import { CopyButton, RelativeTime } from "$lib/dusk/components";
  import { middleEllipsis } from "$lib/dusk/string";
  import { formatDusk, formatDuskExact, formatFee } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
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

  import "./TransactionsList.css";

  /** @type {boolean} */
  export let autoRefreshTime = false;

  /** @type {Transaction}*/
  export let data;

  /** @type {Boolean} */
  export let displayTooltips = false;

  /** @type {"compact" | "full"} */
  export let mode;

  /**
   * The verified primary names of the listed accounts, looked up together.
   *
   * @type {Map<string, { name: string, url: string } | null>}
   */
  export let names = new Map();

  /**
   * @param {Map<string, { name: string, url: string } | null>} found
   * @param {import("$lib/chain-info/summarizeTransaction").TransactionParty | null} party
   */
  const nameOf = (found, party) =>
    party?.kind === "account" ? found.get(party.address) : undefined;

  /** Lists show an ID as its first and last six characters. */
  const ID_CHARS = 6;

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
        >{middleEllipsis(data.txid, ID_CHARS)}</AppAnchor
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
      data-tooltip-text={formatDateTime(data.date)}
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
      <TransactionParty name={nameOf(names, from)} party={from} />
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
      <TransactionParty
        name={nameOf(names, to)}
        party={to}
        transaction={data}
      />
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
        <span title="{formatDuskExact(amount.lux)} DUSK"
          >{formatDusk(amount.lux)} DUSK</span
        >
      {/if}
    </svelte:fragment>
  </ListItem>

  {#if mode === "full"}
    <!-- TX FEE -->
    <ListItem tooltipText={displayTooltips ? "The transaction fee amount" : ""}>
      <svelte:fragment slot="term">Fee</svelte:fragment>
      <svelte:fragment slot="definition">
        <span title="{formatDuskExact(data.feepaid)} DUSK"
          >{formatFee(data.feepaid)} DUSK</span
        >
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
