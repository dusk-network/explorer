<svelte:options immutable={true} />

<script>
  import {
    DataCard,
    TransactionsList,
    TransactionsTable,
  } from "$lib/components";
  import { makeClassName } from "$lib/dusk/string";
  import createNamesStore from "$lib/stores/createNamesStore";

  /** @type {string | Undefined} */
  export let className = undefined;

  /** @type {Transaction[]}*/
  export let txns;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {Boolean} */
  export let isOnHomeScreen = true;

  /** @type {Boolean} */
  export let displayTooltips = false;

  /** @type {boolean} */
  export let isSmallScreen;

  // The verified primary names of the accounts the list shows.
  const names = createNamesStore();

  $: classes = makeClassName(["latest-transactions-card", className]);
  $: names.lookUp(txns ?? []);
</script>

<DataCard
  on:retry
  data={txns}
  {error}
  {loading}
  className={classes}
  title="Transactions"
  emptyText={isOnHomeScreen
    ? "No transactions yet."
    : "No transactions in this block."}
  variant="section"
  headerLink={isOnHomeScreen
    ? { href: "/transactions", label: "All transactions" }
    : undefined}
>
  {#if isSmallScreen}
    {#each txns as txn (txn)}
      <TransactionsList
        autoRefreshTime
        data={txn}
        {displayTooltips}
        names={$names}
      />
    {/each}
  {:else}
    <TransactionsTable
      data={txns}
      className="latest-transactions-card__table"
      {displayTooltips}
      mode={isOnHomeScreen ? "compact" : "full"}
      names={$names}
    />
  {/if}
</DataCard>
