<svelte:options immutable={true} />

<script>
  import { RelativeTime } from "$lib/dusk/components";
  import { middleEllipsis } from "$lib/dusk/string";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import { summarizeTransaction } from "$lib/chain-info";
  import {
    AppAnchor,
    TransactionIcon,
    TransactionParty,
    TransactionType,
  } from "$lib/components";

  import "./TransactionsList.css";

  /** @type {boolean} */
  export let autoRefreshTime = false;

  /** @type {Transaction}*/
  export let data;

  /** @type {Boolean} */
  export let displayTooltips = false;

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
  $: failed = !!data.txerror;
</script>

<!--
  A row of the web wallet's History on a phone: who sent to whom and what it
  did, the amount and when. The whole row opens the transaction; the names
  open their accounts.
-->
<div class="transaction-row">
  <TransactionIcon transaction={data} />
  <div class="transaction-row__main">
    <span class="transaction-row__parties">
      <span class="transaction-row__party">
        <span class="sr-only">From</span>
        <TransactionParty name={nameOf(names, from)} party={from} />
      </span>
      {#if to}
        <span aria-hidden="true" class="transaction-row__arrow">→</span>
        <span class="transaction-row__party">
          <span class="sr-only">To</span>
          <TransactionParty
            name={nameOf(names, to)}
            party={to}
            transaction={data}
          />
        </span>
      {/if}
    </span>
    <span class="row-line transaction-row__line"
      >{#if failed}<span class="row-failed transaction-row__failed">Failed</span
        >
        <span aria-hidden="true">·</span>
      {/if}
      <TransactionType
        {data}
        {displayTooltips}
        nameContract={false}
        showPrivacy={false}
      /></span
    >
  </div>
  <div class="transaction-row__end">
    {#if amount.kind === "shielded"}
      <span class="row-amount row-amount--muted">Shielded</span>
    {:else}
      <span
        class="row-amount"
        class:row-amount--muted={failed || amount.lux === 0}
        ><span title="{formatDuskExact(amount.lux)} DUSK"
          >{formatDusk(amount.lux)}</span
        >
        <span class="row-unit">DUSK</span></span
      >
    {/if}
    <span class="row-line transaction-row__time">
      <RelativeTime
        autoRefresh={autoRefreshTime}
        data-tooltip-id="main-tooltip"
        data-tooltip-text={formatDateTime(data.date)}
        date={data.date}
      />
    </span>
  </div>
  <AppAnchor
    className="transaction-row__link"
    href={`/transactions/transaction?id=${data.txid}`}
    ><span class="sr-only"
      >Transaction {middleEllipsis(data.txid, ID_CHARS)}</span
    ></AppAnchor
  >
</div>
