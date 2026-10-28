<svelte:options immutable={true} />

<script>
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
  } from "$lib/components/table";
  import {
    AppAnchor,
    TransactionIcon,
    TransactionParty,
    TransactionType,
  } from "$lib/components";
  import {
    amountSign,
    directionOf,
    summarizeTransaction,
  } from "$lib/chain-info";
  import { CopyButton, RelativeTime } from "$lib/dusk/components";
  import { formatDusk, formatDuskExact, formatFee } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import { makeClassName, middleEllipsis } from "$lib/dusk/string";
  import "./TransactionsTable.css";

  /** @type {string | Undefined} */
  export let className = undefined;

  /** @type {Transaction[]}*/
  export let data;

  /** @type {boolean} */
  export let displayTooltips = false;

  /**
   * The compact table, on the home page, leaves out the fee and gives the
   * time under the amount.
   *
   * @type {"compact" | "full"}
   */
  export let mode;

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

  /** Lists show an ID as its first and last six characters. */
  const ID_CHARS = 6;

  $: isFull = mode === "full";
  $: classes = makeClassName([
    "transactions-table",
    `transactions-table--${mode}`,
    className,
  ]);
</script>

<Table className={classes}>
  <TableHead>
    <TableRow>
      <TableCell type="th">Transaction</TableCell>
      <TableCell type="th">ID</TableCell>
      {#if isFull}
        <TableCell type="th">Time</TableCell>
        <TableCell align="right" type="th">Fee</TableCell>
      {/if}
      <TableCell align="right" type="th">Amount</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {#each data as transaction (transaction)}
      {@const { amount, from, to } = summarizeTransaction(transaction)}
      {@const failed = !!transaction.txerror}
      {@const direction = directionOf(transaction, account)}
      <TableRow>
        <TableCell>
          <div class="transaction__main">
            <TransactionIcon {direction} {transaction} />
            <div class="transaction__who">
              <span class="transaction__parties">
                <span class="transaction__party">
                  <span class="sr-only">From</span>
                  <TransactionParty name={nameOf(names, from)} party={from} />
                </span>
                {#if to}
                  <span aria-hidden="true" class="transaction__arrow">→</span>
                  <span class="transaction__party">
                    <span class="sr-only">To</span>
                    <TransactionParty
                      name={nameOf(names, to)}
                      party={to}
                      {transaction}
                    />
                  </span>
                {/if}
              </span>
              <span class="row-line transaction__line"
                >{#if failed}<span
                    class="row-failed transaction__failed"
                    data-tooltip-id="main-tooltip"
                    data-tooltip-text={transaction.txerror}
                    data-tooltip-type="error">Failed</span
                  >
                  <span aria-hidden="true">·</span>
                {/if}
                <TransactionType
                  data={transaction}
                  {direction}
                  {displayTooltips}
                  nameContract={to?.kind !== "contract"}
                  showPrivacy={false}
                /></span
              >
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div class="transaction__transaction-id-container">
            <AppAnchor
              className="transaction__link chain-link"
              href={`/transactions/transaction?id=${transaction.txid}`}
              >{middleEllipsis(transaction.txid, ID_CHARS)}</AppAnchor
            >
            {#if isFull}
              <CopyButton name="Transaction ID" rawValue={transaction.txid} />
            {/if}
          </div>
        </TableCell>
        {#if isFull}
          <TableCell>
            <span class="transaction__time">
              <RelativeTime
                data-tooltip-id="main-tooltip"
                data-tooltip-text={formatDateTime(transaction.date)}
                date={transaction.date}
              />
            </span>
          </TableCell>
          <TableCell align="right">
            <span class="transaction__fee"
              ><span title="{formatDuskExact(transaction.feepaid)} DUSK"
                >{formatFee(transaction.feepaid)}</span
              >
              <span class="row-unit">DUSK</span></span
            >
          </TableCell>
        {/if}
        <TableCell align="right">
          {#if amount.kind === "shielded"}
            <span class="row-amount row-amount--muted">Shielded</span>
          {:else}
            <span
              class="row-amount"
              class:row-amount--muted={failed || amount.lux === 0}
              >{amountSign(direction, amount.lux, failed)}<span
                title="{formatDuskExact(amount.lux)} DUSK"
                >{formatDusk(amount.lux)}</span
              >
              <span class="row-unit">DUSK</span></span
            >
          {/if}
          {#if !isFull}
            <span class="row-line transaction__time">
              <RelativeTime
                data-tooltip-id="main-tooltip"
                data-tooltip-text={formatDateTime(transaction.date)}
                date={transaction.date}
              />
            </span>
          {/if}
        </TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>
