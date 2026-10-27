<svelte:options immutable={true} />

<script>
  import {
    mdiAccountGroupOutline,
    mdiCubeOutline,
    mdiCurrencyUsd,
    mdiMapMarker,
    mdiSwapVertical,
    mdiTransitConnectionVariant,
  } from "@mdi/js";
  import { onDestroy, onMount } from "svelte";

  import {
    createCurrencyFormatter,
    formatDuskExact,
    luxToDusk,
  } from "$lib/dusk/currency";
  import { createCompactFormatter } from "$lib/dusk/value";
  import { duskIcon } from "$lib/dusk/icons";
  import { Icon } from "$lib/dusk/components";
  import { DataGuard, StaleDataNotice } from "$lib/components";
  import { duskAPI } from "$lib/services";
  import { createPollingDataStore } from "$lib/dusk/svelte-stores";
  import { isMainnet } from "$lib/network";
  import { appStore, marketDataStore, nodeLocationStore } from "$lib/stores";

  import "./StatisticsPanel.css";

  const valueFormatter = createCurrencyFormatter("en", "DUSK", 0);
  const millionFormatter = createCompactFormatter("en");

  /**
   * @param { number | bigint } value
   */
  const formatter = (value) => {
    return value >= 1e6 ? millionFormatter(value) : valueFormatter(value);
  };

  const pollingStatsDataStore = createPollingDataStore(
    duskAPI.getStats,
    $appStore.statsFetchInterval
  );

  onMount(() => {
    pollingStatsDataStore.start();
  });

  onDestroy(pollingStatsDataStore.stop);

  $: ({ data: marketData } = $marketDataStore);
  $: ({ data: statsData } = $pollingStatsDataStore);
  $: ({ data: nodesData } = $nodeLocationStore);
  // Test DUSK has no value: no price or market cap off mainnet.
  $: marketStatistics = isMainnet($appStore.nodeInfo)
    ? [
        [
          {
            approximate: false,
            attributes: null,
            canBeStale: true,
            compact: true,
            data: marketData?.currentPrice.usd,
            icon: mdiCurrencyUsd,
            prefix: "$",
            title: "DUSK price",
            unit: "",
          },
          {
            approximate: false,
            attributes: null,
            canBeStale: true,
            compact: true,
            data: marketData?.marketCap.usd,
            icon: mdiCurrencyUsd,
            prefix: "$",
            title: "Market cap",
            unit: "",
          },
        ],
      ]
    : [];
  $: statistics = [
    ...marketStatistics,
    [
      {
        approximate: !!statsData?.activeStake,
        attributes: {
          "data-tooltip-id": "main-tooltip",
          "data-tooltip-place": "top",
          "data-tooltip-text": statsData?.activeStake
            ? `${formatDuskExact(statsData.activeStake)} DUSK`
            : "--- DUSK",
          "data-tooltip-type": "info",
        },
        canBeStale: false,
        compact: true,
        data: statsData?.activeStake
          ? luxToDusk(statsData?.activeStake)
          : undefined,
        icon: duskIcon,
        prefix: "",
        title: "Current stake",
        unit: "DUSK",
      },
      {
        approximate: !!statsData?.waitingStake,
        attributes: {
          "data-tooltip-id": "main-tooltip",
          "data-tooltip-place": "top",
          "data-tooltip-text": statsData?.waitingStake
            ? `${formatDuskExact(statsData.waitingStake)} DUSK`
            : "--- DUSK",
          "data-tooltip-type": "info",
        },
        canBeStale: false,
        compact: true,
        data: statsData?.waitingStake
          ? luxToDusk(statsData?.waitingStake)
          : undefined,
        icon: duskIcon,
        prefix: "",
        title: "Pending stake",
        unit: "DUSK",
      },
    ],

    [
      {
        approximate: false,
        attributes: null,
        canBeStale: false,
        compact: false,
        data: statsData?.lastBlock,
        icon: mdiCubeOutline,
        prefix: "",
        title: "Last block",
        unit: "",
      },
      {
        approximate: false,
        attributes: statsData?.txCount
          ? {
              "data-tooltip-id": "main-tooltip",
              "data-tooltip-place": "top",
              "data-tooltip-text": `Public: ${formatter(
                statsData.txCount.public
              )}, Shielded: ${formatter(statsData.txCount.shielded)}`,
            }
          : null,
        canBeStale: false,
        compact: true,
        data: statsData?.txCount?.total,
        icon: mdiSwapVertical,
        prefix: "",
        title: "Total transactions",
        unit: "",
      },
    ],

    [
      {
        approximate: false,
        attributes: null,
        canBeStale: false,
        compact: true,
        data: statsData?.activeProvisioners,
        icon: mdiAccountGroupOutline,
        prefix: "",
        title: "Active provisioners",
        unit: "",
      },
      {
        approximate: false,
        attributes: null,
        canBeStale: false,
        compact: true,
        data: statsData?.waitingProvisioners,
        icon: mdiAccountGroupOutline,
        prefix: "",
        title: "Pending provisioners",
        unit: "",
      },
    ],

    [
      {
        approximate: false,
        attributes: null,
        canBeStale: false,
        compact: true,
        data: nodesData?.length ? nodesData[0].count : null,
        icon: mdiTransitConnectionVariant,
        prefix: "",
        title: "Largest node cluster",
        unit: "nodes",
      },
      {
        approximate: false,
        attributes: null,
        canBeStale: false,
        compact: null,
        data: nodesData?.length
          ? `${nodesData[0].city}, ${nodesData[0].countryCode}`
          : null,
        icon: mdiMapMarker,
        prefix: "",
        title: "Largest cluster location",
        unit: "",
      },
    ],
  ];
</script>

<!-- One card per number: the label above, muted, and the number below. -->
<div class="statistics-panel">
  <div class="statistics-panel__statistics">
    {#each statistics as statistic, index (index)}
      <div class="statistics-panel__statistics-column">
        {#each statistic as item (`${item.title}`)}
          <div class="statistics-panel__statistics-item" {...item.attributes}>
            <span class="statistics-panel__statistics-item-title"
              ><Icon path={item.icon} size="default" />{item.title}</span
            >
            <div class="statistics-panel__statistics-item-value-container">
              <div
                class="statistics-panel__statistics-item-value"
                class:approximate={item.approximate}
              >
                <DataGuard data={item.data}>
                  {item.prefix}{#if item.compact}
                    {formatter(item.data)}
                  {:else if item.compact === null}
                    {item.data}
                  {:else}
                    {valueFormatter(item.data)}
                  {/if}
                </DataGuard>
              </div>
              {#if item.unit && (item.data || item.data === 0)}
                <span class="statistics-panel__statistics-item-unit"
                  >{item.unit}</span
                >
              {/if}
              {#if item.canBeStale}
                <StaleDataNotice />
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
