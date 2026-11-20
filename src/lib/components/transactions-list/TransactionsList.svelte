<svelte:options immutable={true} />

<script>
  import { RelativeTime } from "$lib/dusk/components";
  import { shortId } from "$lib/dusk/string";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import {
    amountSign,
    directionOf,
    summarizeTransaction,
  } from "$lib/chain-info";
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
   * The account whose page lists the transactions: each then says which
   * way it went for it, by its icon and its amount's sign.
   *
   * @type {string | undefined}
   */
  export let account = undefined;

  /**
   * @param {Map<string, { name: string, url: string } | null>} found
   * @param {import("$lib/chain-info/summarizeTransaction").TransactionParty | null} party
   */
  const nameOf = (found, party) =>
    party?.kind === "account" ? found.get(party.address) : undefined;

  $: ({ amount, from, to } = summarizeTransaction(data));
  $: failed = !!data.txerror;
  $: direction = directionOf(data, account);
</script>

<!--
  A row of the web wallet's History on a phone: who sent to whom and what it
  did, the amount and when. The whole row opens the transaction; the names
  open their accounts.
-->
<div class="transaction-row">
  <TransactionIcon {direction} transaction={data} />
  <div class="transaction-row__main">
    <span class="transaction-row__parties">
      <span class="transaction-row__party">
        <span class="sr-only">From</span>
        <TransactionParty
          contractWord={false}
          name={nameOf(names, from)}
          narrow
          party={from}
        />
      </span>
      {#if to}
        <span aria-hidden="true" class="transaction-row__arrow">→</span>
        <span class="transaction-row__party">
          <span class="sr-only">To</span>
          <TransactionParty
            contractWord={false}
            name={nameOf(names, to)}
            narrow
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
        {direction}
        {displayTooltips}
        nameContract={to?.kind !== "contract"}
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
        class:row-amount--unsent={failed && amount.lux > 0}
        >{amountSign(direction, amount.lux, failed)}<span
          title="{formatDuskExact(amount.lux)} DUSK"
          >{formatDusk(amount.lux)}</span
        >
        <span class="row-unit">DUSK</span>{#if failed && amount.lux > 0}<span
            class="sr-only">, nothing sent</span
          >{/if}</span
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
    ><span class="sr-only">Transaction {shortId(data.txid)}</span></AppAnchor
  >
</div>
