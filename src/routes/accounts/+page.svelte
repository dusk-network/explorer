<script>
  import { page } from "$app/stores";
  import { AccountOverview, TransactionsCard } from "$lib/components/";
  import { getStakedDusk } from "$lib/contracts";
  import { duskAPI } from "$lib/services";
  import { appStore } from "$lib/stores";
  import { createDataStore } from "$lib/dusk/svelte-stores";

  const dataStore = createDataStore(duskAPI.getMoonlightAccountTransactions);
  const getTransactions = () => {
    if (key) {
      dataStore.reset();
      dataStore.getData(key);
    }
  };

  /**
   * The account reads in flight answer only for the account last asked
   * for: going A → B → A, the first A's late answer is dropped.
   */
  let generation = 0;

  let errorFetchingAccountStatus = false;
  /** @type {AccountStatus|null} */
  let accountStatus = null;

  /**
   * @param {string} accountKey
   * @param {number} asked The generation that asks
   */
  function fetchAccountStatus(accountKey, asked) {
    accountStatus = null;
    duskAPI.getAccountStatus(accountKey).then(
      (status) => {
        if (asked === generation) {
          accountStatus = status;
          errorFetchingAccountStatus = false;
        }
      },
      () => {
        if (asked === generation) {
          errorFetchingAccountStatus = true;
        }
      }
    );
  }

  let errorFetchingStake = false;
  /** @type {AccountStake | null | undefined} */
  let stake = undefined;

  /**
   * One read of the stake contract per account shown.
   *
   * @param {string} accountKey
   * @param {number} asked The generation that asks
   */
  function fetchStake(accountKey, asked) {
    stake = undefined;
    errorFetchingStake = false;
    duskAPI.getStake(accountKey).then(
      (result) => {
        if (asked === generation) {
          stake = result;
        }
      },
      () => {
        if (asked === generation) {
          errorFetchingStake = true;
        }
      }
    );
  }

  /** @type {bigint | null} */
  let stakedDusk = null;

  /** @type {string | null} */
  let lastStakedDuskAsk = null;

  /**
   * The account's stDUSK from Sozu, in one Multicall for Dusk query, once
   * the node has said which network it is on. A failed read shows nothing.
   *
   * @param {string} accountKey
   * @param {number | null} chain The node's network
   * @param {number} asked The generation that asks
   */
  function fetchStakedDusk(accountKey, chain, asked) {
    stakedDusk = null;
    getStakedDusk(accountKey, chain).then(
      (result) => {
        if (asked === generation) {
          stakedDusk = result;
        }
      },
      () => {}
    );
  }

  /** @type {{ date: Date, height: number } | null} */
  let tip = null;

  let isTipAsked = false;

  // A stake's dates count from the last block: one more query, once, and
  // only for a provisioner.
  function askForTip() {
    if (isTipAsked) {
      return;
    }

    isTipAsked = true;
    duskAPI.getChainTip().then(
      (last) => {
        tip = last;
      },
      () => {
        isTipAsked = false;
      }
    );
  }

  $: if (stake && (stake.active || stake.inactive)) {
    askForTip();
  }

  /** @type {string | null} */
  let lastRequestedKey = null;

  $: key = $page.url.searchParams.get("key");
  $: searchedName = $page.url.searchParams.get("name");
  $: if (key && key !== lastRequestedKey) {
    lastRequestedKey = key;
    generation += 1;
    getTransactions();
    fetchAccountStatus(key, generation);
    fetchStake(key, generation);
  }
  $: chainId = $appStore.nodeInfo.chain_id;
  $: if (
    key &&
    chainId !== undefined &&
    `${key}:${chainId}` !== lastStakedDuskAsk
  ) {
    lastStakedDuskAsk = `${key}:${chainId}`;
    fetchStakedDusk(key, chainId, generation);
  }
  $: ({ data, error, isLoading } = $dataStore);
  $: ({ isSmallScreen } = $appStore);
</script>

{#if key}
  <section>
    <article>
      <AccountOverview
        {errorFetchingAccountStatus}
        {errorFetchingStake}
        accountBalance={accountStatus?.balance}
        accountAddress={key}
        {searchedName}
        {stake}
        {stakedDusk}
        {tip}
      />
    </article>

    <TransactionsCard
      on:retry={getTransactions}
      account={key}
      txns={data}
      {error}
      loading={isLoading}
      {isSmallScreen}
      variant="section"
    />
  </section>
{:else}
  <p class="account-missing">No account given.</p>
{/if}

<style lang="postcss">
  .account-missing {
    margin: 0;
    color: var(--calm-muted);
  }
</style>
