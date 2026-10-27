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
  import { DataGuard, StaleDataNotice, WorldMap } from "$lib/components";
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

  /** No new block for this long, and the page says it waits for one. */
  const WAITING_AFTER = 30_000;

  /** The newest block the page has seen, and when it came. */
  let newest = { at: 0, height: -1 };

  /** The time, to the second, to tell how long ago that was. */
  let now = Date.now();

  /** @type {ReturnType<typeof setInterval> | undefined} */
  let clock;

  /**
   * A block is new when the page first sees its height. The first one the
   * page sees came no later than the block's own time: a chain that has
   * stopped isn't live when the page opens on it.
   *
   * @param {number | undefined} height
   * @param {Date | undefined} date
   */
  function see(height, date) {
    if (height === undefined || height === newest.height) {
      return;
    }

    now = Date.now();
    newest = {
      at: newest.height < 0 && date ? Math.min(now, date.getTime()) : now,
      height,
    };
  }

  onMount(() => {
    pollingStatsDataStore.start();
    clock = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    pollingStatsDataStore.stop();
    clearInterval(clock);
  });

  $: ({ data: marketData } = $marketDataStore);
  $: ({ data: statsData } = $pollingStatsDataStore);
  $: ({ data: nodesData } = $nodeLocationStore);
  $: see(statsData?.lastBlock, statsData?.lastBlockDate);
  $: live = newest.height >= 0 && now - newest.at < WAITING_AFTER;
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
  The network's map first, and beside it the four numbers that matter most
  as cards, their labels above them; the rest in one quiet row of smaller
  labels and values.
-->
<div class="statistics-panel">
  <figure class="statistics-panel__face">
    <WorldMap nodes={nodesData ?? []} />
    <figcaption class="statistics-panel__face-caption">
      Rings show where provisioners run nodes. The bigger the ring, the more
      nodes.
    </figcaption>
  </figure>
  <div class="statistics-panel__statistics">
    {#each primary as key (key)}
      {@const item = items[key]}
      <div
        class="statistics-panel__statistics-item statistics-panel__statistics-item--primary"
        {...item.attributes}
      >
        <span class="statistics-panel__statistics-item-title"
          ><Icon
            path={item.icon}
            size="default"
          />{item.title}{#if key === "lastBlock"}
            <!-- Live while new blocks come, and says so when none has for a while. -->
            <span
              class="statistics-panel__live"
              class:statistics-panel__live--waiting={!live}
              role="status"
              >{#key newest.height}<span
                  aria-hidden="true"
                  class="statistics-panel__live-dot"
                ></span>{/key}{live ? "Live" : "Waiting for blocks"}</span
            >
          {/if}</span
        >
        <div class="statistics-panel__statistics-item-value-container">
          {#if item.approximate}
            <span class="statistics-panel__statistics-item-about"
              ><span aria-hidden="true">≈</span><span class="sr-only"
                >about</span
              ></span
            >
          {/if}
          <div class="statistics-panel__statistics-item-value">
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
          {#if item.approximate}
            <span class="statistics-panel__statistics-item-about"
              ><span aria-hidden="true">≈</span><span class="sr-only"
                >about</span
              ></span
            >
          {/if}
          <span class="statistics-panel__statistics-item-value">
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
