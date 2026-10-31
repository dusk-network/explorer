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

  /**
   * Asks the page for the transactions after the ones it gave, when there
   * may be more than those; none once they are all there is.
   *
   * @type {(() => void) | undefined}
   */
  export let more = undefined;

  const ITEMS_TO_DISPLAY = get(appStore).chainInfoEntries;

  let itemsToDisplay = ITEMS_TO_DISPLAY;

  /** @type {Transaction[]}*/
  let displayedTxns;

  $: displayedTxns = txns ? txns.slice(0, itemsToDisplay) : [];
  $: hasMore = Boolean(txns && (itemsToDisplay < txns.length || more));

  // The verified primary names of the accounts the list shows.
  const names = createNamesStore();

  $: names.lookUp(displayedTxns);

  /** How many the card held when it asked for more, until more come. */
  let askedWith = -1;

  $: waiting =
    askedWith >= 0 && !!more && !error && (txns?.length ?? 0) <= askedWith;

  // The next rows, asking the page for more once they pass what it gave.
  const loadMoreItems = () => {
    if (!txns || !hasMore || waiting) {
      return;
    }

    itemsToDisplay += ITEMS_TO_DISPLAY;

    if (more && itemsToDisplay > txns.length) {
      askedWith = txns.length;
      more();
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
    <!-- How many of all there are, once the page gave them all. -->
    {#if !more}
      <span class="data-card__count"
        >{displayedTxns.length} of {txns?.length ?? 0}</span
      >
    {/if}
    {#if hasMore}
      <Button
        disabled={waiting}
        on:click={loadMoreItems}
        text={waiting ? "Loading…" : "Show more"}
        variant="secondary"
      />
    {/if}
  </svelte:fragment>
</DataCard>
