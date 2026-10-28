<script>
  import { BlocksCard } from "$lib/components";
  import { duskAPI, followBlocks } from "$lib/services";
  import { appStore } from "$lib/stores";
  import { createPollingDataStore } from "$lib/dusk/svelte-stores";
  import { onDestroy, onMount } from "svelte";

  const pollingDataStore = createPollingDataStore(
    followBlocks(duskAPI),
    $appStore.fetchInterval
  );

  onMount(() => pollingDataStore.start($appStore.blocksListEntries));
  onDestroy(pollingDataStore.stop);

  $: ({ data, error, isLoading } = $pollingDataStore);
  $: ({ blocksListEntries, isSmallScreen } = $appStore);
</script>

<section>
  <BlocksCard
    on:retry={() => pollingDataStore.start(blocksListEntries)}
    blocks={data}
    {error}
    loading={isLoading}
    {isSmallScreen}
  />
</section>
