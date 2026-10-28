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
    TransactionParty,
    TransactionStatus,
    TransactionType,
  } from "$lib/components";
  import { summarizeTransaction } from "$lib/chain-info";
  import { CopyButton, RelativeTime } from "$lib/dusk/components";
  import { createFeeFormatter, luxToDusk } from "$lib/dusk/currency";
  import { makeClassName, middleEllipsis } from "$lib/dusk/string";
  import "./TransactionsTable.css";

  /** @type {string | Undefined} */
  export let className = undefined;

  /** @type {Transaction[]}*/
  export let data;

  /** @type {boolean} */
  export let displayTooltips = false;

  /**
   * The compact table, on the home page, leaves out the fee and the status
   * column: a failed transaction says so beside its time.
   *
   * @type {"compact" | "full"}
   */
  export let mode;

  const duskFormatter = createFeeFormatter("en");

  $: isFull = mode === "full";
  $: hashChars = isFull ? 10 : 6;
  $: classes = makeClassName([
    "transactions-table",
    `transactions-table--${mode}`,
    className,
  ]);
</script>

<Table className={classes}>
  <TableHead>
    <TableRow>
      <TableCell type="th">ID</TableCell>
      <TableCell type="th">From / To</TableCell>
      <TableCell type="th">Amount (DUSK)</TableCell>
      {#if isFull}
        <TableCell type="th">Fee (DUSK)</TableCell>
        <TableCell type="th">Status</TableCell>
      {/if}
      <TableCell type="th">Type</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {#each data as transaction (transaction)}
      {@const { amount, from, to } = summarizeTransaction(transaction)}
      <TableRow>
        <TableCell>
          <div class="transaction__transaction-id-container">
            <AppAnchor
              className="transaction__link"
              href={`/transactions/transaction?id=${transaction.txid}`}
              >{middleEllipsis(transaction.txid, hashChars)}</AppAnchor
            >
            {#if isFull}
              <CopyButton
                name="Transaction ID"
                rawValue={transaction.txid}
                variant="secondary"
              />
            {/if}
          </div>
          <span class="transaction__time">
            <RelativeTime
              data-tooltip-id="main-tooltip"
              data-tooltip-text={transaction.date.toUTCString()}
              date={transaction.date}
            />
            {#if !isFull && transaction.txerror}
              · <span class="transaction__failed">Failed</span>
            {/if}
          </span>
        </TableCell>
        <TableCell>
          <span class="transaction__party">
            <span class="sr-only">From</span>
            <TransactionParty party={from} />
          </span>
          <span class="transaction__party">
            <span class="sr-only">To</span>
            <TransactionParty party={to} />
          </span>
        </TableCell>
        <TableCell>
          {#if amount.kind === "shielded"}
            <span class="transaction__muted">Shielded</span>
          {:else}
            <span class:transaction__muted={amount.lux === 0}
              >{duskFormatter(luxToDusk(amount.lux))}</span
            >
          {/if}
        </TableCell>
        {#if isFull}
          <TableCell>{duskFormatter(luxToDusk(transaction.feepaid))}</TableCell>
          <TableCell>
            <TransactionStatus
              errorMessage={transaction.txerror}
              showErrorTooltip={false}
            />
          </TableCell>
        {/if}
        <TableCell>
          <TransactionType
            data={transaction}
            {displayTooltips}
            showPrivacy={false}
          />
        </TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>
