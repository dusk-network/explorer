<svelte:options immutable={true} />

<script>
  import { get } from "svelte/store";
  import {
    DataCard,
    TransactionsList,
    TransactionsTable,
  } from "$lib/components";
  import { accountsOf } from "$lib/chain-info";
  import { Button } from "$lib/dusk/components";
  import { getPrimaryNames } from "$lib/dusk-domains";
  import { appStore } from "$lib/stores";

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
  $: lookUpNames(displayedTxns);

  /**
   * The verified primary names of the accounts the list shows: one lookup
   * for all of them, which Multicall for Dusk carries in one query, and
   * none for an account already looked up this session.
   *
   * @type {Map<string, { name: string, url: string } | null>}
   */
  let names = new Map();

  /** @param {Transaction[]} shown */
  function lookUpNames(shown) {
    getPrimaryNames(accountsOf(shown)).then((found) => {
      names = new Map([...names, ...found]);
    });
  }

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
        <TransactionsList {account} data={txn} {names} />
      {/each}
    </div>
  {:else}
    <TransactionsTable
      {account}
      data={displayedTxns}
      displayTooltips={true}
      mode="full"
      {names}
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
