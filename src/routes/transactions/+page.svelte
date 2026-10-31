<script>
  import { TransactionsCard } from "$lib/components";
  import { duskAPI, followTransactions } from "$lib/services";
  import { appStore, chainHeadStore } from "$lib/stores";
  import { createFollowingDataStore } from "$lib/dusk/svelte-stores";
  import { onDestroy, onMount } from "svelte";

  // Read again at each new block.
  const pollingDataStore = createFollowingDataStore(
    followTransactions(duskAPI),
    chainHeadStore
  );

  /** How many of the latest transactions the page reads: a page more each time it is asked for more. */
  let amount = $appStore.transactionsListEntries;

  /** Whether the page asked for more, until that read ends. */
  let asking = false;

  const more = () => {
    asking = true;
    amount += $appStore.transactionsListEntries;
    pollingDataStore.start(amount);
  };

  onMount(() => pollingDataStore.start(amount));
  onDestroy(pollingDataStore.stop);

  $: ({ data, error, isLoading } = $pollingDataStore);
  $: ({ isSmallScreen } = $appStore);
  $: if (asking && !isLoading) {
    asking = false;
  }

  // Fewer than it read: the chain has no more.
  $: complete = !asking && Array.isArray(data) && data.length < amount;
</script>

<section>
  <TransactionsCard
    on:retry={() => pollingDataStore.start(amount)}
    more={complete ? undefined : more}
    txns={data}
    {error}
    loading={isLoading}
    {isSmallScreen}
  />
</section>
