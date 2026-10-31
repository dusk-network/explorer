<script>
  import { BlocksCard } from "$lib/components";
  import { duskAPI, followBlocks } from "$lib/services";
  import { appStore, chainHeadStore } from "$lib/stores";
  import { createFollowingDataStore } from "$lib/dusk/svelte-stores";
  import { onDestroy, onMount } from "svelte";

  // Read again at each new block.
  const pollingDataStore = createFollowingDataStore(
    followBlocks(duskAPI),
    chainHeadStore
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
