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
  /**
   * @typedef {{
   *   approximate: boolean,
   *   attributes: Record<string, string> | null,
   *   canBeStale: boolean,
   *   compact: boolean | null,
   *   data: any,
   *   icon: string,
   *   prefix: string,
   *   title: string,
   *   unit: string,
   * }} Statistic
   */

  /** @type {Record<string, Statistic>} */
  $: items = {
    activeProvisioners: {
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
    clusterLocation: {
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
    currentStake: {
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
    largestCluster: {
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
    lastBlock: {
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
    marketCap: {
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
    pendingProvisioners: {
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
    pendingStake: {
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
    price: {
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
    totalTransactions: {
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
  };

  // Test DUSK has no value: no price or market cap off mainnet. Four
  // numbers lead; the rest follow, smaller.
  $: [primary, secondary] = isMainnet($appStore.nodeInfo)
    ? [
        ["price", "currentStake", "lastBlock", "totalTransactions"],
        [
          "marketCap",
          "activeProvisioners",
          "pendingStake",
          "pendingProvisioners",
          "largestCluster",
          "clusterLocation",
        ],
      ]
    : [
        [
          "currentStake",
          "lastBlock",
          "totalTransactions",
          "activeProvisioners",
        ],
        [
          "pendingStake",
          "pendingProvisioners",
          "largestCluster",
          "clusterLocation",
        ],
      ];
</script>

<!--
  The four numbers that matter most as cards, their labels muted above them;
  the rest in one quiet row of smaller labels and values.
-->
<div class="statistics-panel">
  <div class="statistics-panel__statistics">
    {#each primary as key (key)}
      {@const item = items[key]}
      <div
        class="statistics-panel__statistics-item statistics-panel__statistics-item--primary"
        {...item.attributes}
      >
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
  <dl class="statistics-panel__secondary">
    {#each secondary as key (key)}
      {@const item = items[key]}
      <div
        class="statistics-panel__statistics-item statistics-panel__statistics-item--secondary"
        {...item.attributes}
      >
        <dt class="statistics-panel__statistics-item-title">{item.title}</dt>
        <dd class="statistics-panel__statistics-item-value-container">
          <span
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
          </span>
          {#if item.unit && (item.data || item.data === 0)}
            <span class="statistics-panel__statistics-item-unit"
              >{item.unit}</span
            >
          {/if}
          {#if item.canBeStale}
            <StaleDataNotice />
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
</div>
