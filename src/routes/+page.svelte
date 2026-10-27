<script>
  import { onMount } from "svelte";

  import {
    LatestBlocksCard,
    LatestTransactionsCard,
    WorldMap,
  } from "$lib/components";
  import { StatisticsPanel } from "$lib/containers";
  import { Card } from "$lib/dusk/components";
  import { duskAPI } from "$lib/services";
  import { appStore, nodeLocationStore } from "$lib/stores";
  import { createPollingDataStore } from "$lib/dusk/svelte-stores";

  const pollingDataStore = createPollingDataStore(
    duskAPI.getLatestChainInfo,
    $appStore.fetchInterval
  );

  $: ({ data, error, isLoading } = $pollingDataStore);
  $: ({ chainInfoEntries, isSmallScreen } = $appStore);
  $: ({ data: nodesData } = $nodeLocationStore);

  const retry = () => {
    pollingDataStore.start(chainInfoEntries);
  };

  onMount(() => {
    pollingDataStore.start(chainInfoEntries);

    return () => {
      pollingDataStore.stop();
    };
  });
</script>

<section class="landing">
  <h1 class="sr-only">Dusk Explorer</h1>
  <article class="chain-info">
    <StatisticsPanel />
  </article>

  <div class="tables">
    <LatestBlocksCard
      on:retry={retry}
      className="tables-layout tables-layout--blocks"
      blocks={data?.blocks}
      {error}
      {isSmallScreen}
      loading={isLoading}
    />

    <LatestTransactionsCard
      on:retry={retry}
      className="tables-layout tables-layout--transactions"
      txns={data?.transactions}
      {error}
      {isSmallScreen}
      loading={isLoading}
    />
  </div>

  {#if nodesData}
    <div class="world-map">
      <Card>
        <WorldMap nodes={nodesData} />
      </Card>
    </div>
  {/if}
</section>

<style lang="postcss">
  :global {
    .landing {
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    .chain-info {
      order: 1;
    }

    .tables {
      order: 2;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2.5rem;
    }

    .tables-layout {
      min-width: 0;
    }

    .world-map {
      order: 3;
      width: 100%;
    }

    .world-map .dusk-card {
      width: 100%;
      padding: 1.5rem;
      overflow: hidden;
      border: 1px solid var(--calm-line2);
      background-color: transparent;
    }

    @media (max-width: 74.99rem) {
      .tables {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    /* Phones and tablets, with the lists' rows: the latest transactions first. */
    @media (max-width: 64rem) {
      .landing {
        gap: 2rem;
      }

      .tables-layout--transactions {
        order: -1;
      }

      .world-map .dusk-card {
        padding: 0.75rem;
      }
    }
  }
</style>
