<svelte:options immutable={true} />

<script>
  import { get } from "svelte/store";
  import {
    DataCard,
    TransactionsList,
    TransactionsTable,
  } from "$lib/components";
  import { Button } from "$lib/dusk/components";
  import { appStore } from "$lib/stores";
  import createNamesStore from "$lib/stores/createNamesStore";

  /** @type {Transaction[] | null}*/
  export let txns;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {boolean} */
  export let isSmallScreen;

  /**
   * The account whose page lists the transactions, if any.
   *
   * @type {string | undefined}
   */
  export let account = undefined;

  /**
   * A page of its own, or a section of an account's page.
   *
   * @type {"page" | "section"}
   */
  export let variant = "page";

  const ITEMS_TO_DISPLAY = get(appStore).chainInfoEntries;

  let itemsToDisplay = ITEMS_TO_DISPLAY;

  /** @type {Transaction[]}*/
  let displayedTxns;

  $: displayedTxns = txns ? txns.slice(0, itemsToDisplay) : [];
  $: hasMore = Boolean(txns && itemsToDisplay < txns.length);

  // The verified primary names of the accounts the list shows.
  const names = createNamesStore();

  $: names.lookUp(displayedTxns);

  const loadMoreItems = () => {
    if (txns && itemsToDisplay < txns.length) {
      itemsToDisplay += ITEMS_TO_DISPLAY;
    }
  };
</script>

<DataCard
  on:retry
  data={txns}
  emptyText="No transactions yet."
  {error}
  {loading}
  title="Transactions"
  {variant}
>
  {#if isSmallScreen}
    <div class="data-card__list">
      {#each displayedTxns as txn (txn)}
        <TransactionsList {account} data={txn} names={$names} />
      {/each}
    </div>
  {:else}
    <TransactionsTable
      {account}
      data={displayedTxns}
      displayTooltips={true}
      mode="full"
      names={$names}
    />
  {/if}
  <svelte:fragment slot="footer">
    <span class="data-card__count"
      >{displayedTxns.length} of {txns?.length ?? 0}</span
    >
    {#if hasMore}
      <Button on:click={loadMoreItems} text="Show more" variant="secondary" />
    {/if}
  </svelte:fragment>
</DataCard>
