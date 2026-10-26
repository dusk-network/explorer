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

  /** @type {Transaction[] | null}*/
  export let txns;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {boolean} */
  export let isSmallScreen;

  const ITEMS_TO_DISPLAY = get(appStore).chainInfoEntries;

  let itemsToDisplay = ITEMS_TO_DISPLAY;

  /** @type {Transaction[]}*/
  let displayedTxns;

  $: displayedTxns = txns ? txns.slice(0, itemsToDisplay) : [];
  $: hasMore = Boolean(txns && itemsToDisplay < txns.length);

  const loadMoreItems = () => {
    if (txns && itemsToDisplay < txns.length) {
      itemsToDisplay += ITEMS_TO_DISPLAY;
    }
  };
</script>

<DataCard on:retry data={txns} {error} {loading} title="Transactions">
  {#if isSmallScreen}
    <div class="data-card__list">
      {#each displayedTxns as txn (txn)}
        <TransactionsList data={txn} mode="full" />
      {/each}
    </div>
  {:else}
    <TransactionsTable
      data={displayedTxns}
      displayTooltips={true}
      mode="full"
    />
  {/if}
  <svelte:fragment slot="footer">
    <span class="data-card__count"
      >{displayedTxns.length} of {txns?.length ?? 0}</span
    >
    {#if hasMore}
      <Button on:click={loadMoreItems} text="Show More" variant="tertiary" />
    {/if}
  </svelte:fragment>
</DataCard>
