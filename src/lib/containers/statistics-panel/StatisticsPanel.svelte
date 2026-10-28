<svelte:options immutable={true} />

<script>
  import {
    mdiAccountGroupOutline,
    mdiCubeOutline,
    mdiCurrencyUsd,
    mdiSwapVertical,
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

  /** A read this long after the one before it, or longer, follows a gap. */
  const GAP_AFTER = $appStore.statsFetchInterval + 5_000;

  /** The newest block the page has read, and when it came. */
  let newest = { at: 0, height: -1 };

  /** The time, to the second, to tell how long ago that was. */
  let now = Date.now();

  /** The last answer read, and when it came. */
  let lastRead = { at: 0, data: /** @type {Stats | null} */ (null) };

  /** Whether the reading stopped since then: a hidden tab or a failed read. */
  let interrupted = false;

  /** @type {ReturnType<typeof setInterval> | undefined} */
  let clock;

  /**
   * When a new height's block came. Read on a regular poll, as the page
   * watched, it came now, whatever the viewer's clock says. Read when the
   * page opens, or after a gap, it came at its own time, no later than
   * now: a chain that stopped meanwhile isn't live.
   *
   * @param {Stats | null} data
   * @param {Error | null} error
   */
  function read(data, error) {
    if (error) {
      interrupted = true;

      return;
    }

    if (!data || data === lastRead.data) {
      return;
    }

    const arrived = Date.now();
    const regular =
      newest.height >= 0 && !interrupted && arrived - lastRead.at <= GAP_AFTER;
    const made = data.lastBlockDate?.getTime() ?? arrived;

    if (data.lastBlock !== newest.height) {
      newest = {
        at: regular ? arrived : Math.min(arrived, made),
        height: data.lastBlock,
      };
    }

    now = arrived;
    lastRead = { at: arrived, data };
    interrupted = false;
  }

  /** A hidden tab stops the reading: the next read follows a gap. */
  function noteHidden() {
    if (document.hidden) {
      interrupted = true;
    }
  }

  onMount(() => {
    pollingStatsDataStore.start();
    clock = setInterval(() => {
      now = Date.now();
    }, 1000);
    document.addEventListener("visibilitychange", noteHidden);
  });

  onDestroy(() => {
    pollingStatsDataStore.stop();
    clearInterval(clock);
    document.removeEventListener("visibilitychange", noteHidden);
  });

  $: ({ data: marketData } = $marketDataStore);
  $: ({ data: statsData, error: statsError } = $pollingStatsDataStore);
  $: ({ data: nodesData } = $nodeLocationStore);
  $: read(statsData, statsError);

  // The node locates the nodes it knows of, each by its public IP address,
  // to the city; the map groups them by city.
  $: located = nodesData?.reduce((sum, { count }) => sum + count, 0) ?? 0;
  $: locatedNodes =
    located === 1 ? "1 node" : located ? `${located} nodes` : "the nodes";

  /**
   * Live while new blocks come, waiting once the newest read is over 30
   * seconds old; nothing said while the last block can't be read, or
   * hasn't been yet.
   *
   * @type {"live" | "waiting" | "unknown"}
   */
  $: chain =
    statsError || newest.height < 0
      ? "unknown"
      : now - newest.at < WAITING_AFTER
        ? "live"
        : "waiting";
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

  /**
   * A number, compact unless it says otherwise. Only the four that lead
   * have an icon.
   *
   * @param {string} title
   * @param {any} data
   * @param {Partial<Statistic>} [rest]
   * @returns {Statistic}
   */
  const statistic = (title, data, rest = {}) => ({
    approximate: false,
    attributes: null,
    canBeStale: false,
    compact: true,
    data,
    icon: "",
    prefix: "",
    title,
    unit: "",
    ...rest,
  });

  /**
   * A stake, rounded to the DUSK, with the exact amount on hover.
   *
   * @param {string} title
   * @param {number | undefined} lux
   */
  const stakeStatistic = (title, lux) =>
    statistic(title, lux ? luxToDusk(lux) : undefined, {
      approximate: !!lux,
      attributes: {
        "data-tooltip-id": "main-tooltip",
        "data-tooltip-place": "top",
        "data-tooltip-text": lux ? `${formatDuskExact(lux)} DUSK` : "--- DUSK",
        "data-tooltip-type": "info",
      },
      icon: duskIcon,
      unit: "DUSK",
    });

  /** @type {Record<string, Statistic>} */
  $: items = {
    activeProvisioners: statistic(
      "Active provisioners",
      statsData?.activeProvisioners,
      { icon: mdiAccountGroupOutline }
    ),
    clusterLocation: statistic(
      "Largest cluster location",
      nodesData?.length
        ? `${nodesData[0].city}, ${nodesData[0].countryCode}`
        : null,
      { compact: null }
    ),
    currentStake: stakeStatistic("Current stake", statsData?.activeStake),
    largestCluster: statistic(
      "Largest node cluster",
      nodesData?.length ? nodesData[0].count : null,
      { unit: "nodes" }
    ),
    lastBlock: statistic("Last block", statsData?.lastBlock, {
      compact: false,
      icon: mdiCubeOutline,
    }),
    marketCap: statistic("Market cap", marketData?.marketCap.usd, {
      canBeStale: true,
      prefix: "$",
    }),
    pendingProvisioners: statistic(
      "Pending provisioners",
      statsData?.waitingProvisioners
    ),
    pendingStake: stakeStatistic("Pending stake", statsData?.waitingStake),
    price: statistic("DUSK price", marketData?.currentPrice.usd, {
      canBeStale: true,
      icon: mdiCurrencyUsd,
      prefix: "$",
    }),
    totalTransactions: statistic(
      "Total transactions",
      statsData?.txCount?.total,
      {
        attributes: statsData?.txCount
          ? {
              "data-tooltip-id": "main-tooltip",
              "data-tooltip-place": "top",
              "data-tooltip-text": `Public: ${formatter(
                statsData.txCount.public
              )}, Shielded: ${formatter(statsData.txCount.shielded)}`,
            }
          : null,
        icon: mdiSwapVertical,
      }
    ),
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

<!-- A number's value: "≈" when rounded, its unit, and whether it is stale. -->
{#snippet valueOf(
  /** @type {Statistic} */ item,
  /** @type {"div" | "span"} */ tag
)}
  {#if item.approximate}
    <span class="statistics-panel__statistics-item-about"
      ><span aria-hidden="true">≈</span><span class="sr-only">about</span></span
    >
  {/if}
  <svelte:element this={tag} class="statistics-panel__statistics-item-value">
    <DataGuard data={item.data}>
      {item.prefix}{#if item.compact}
        {formatter(item.data)}
      {:else if item.compact === null}
        {item.data}
      {:else}
        {valueFormatter(item.data)}
      {/if}
    </DataGuard>
  </svelte:element>
  {#if item.unit && (item.data || item.data === 0)}
    <span class="statistics-panel__statistics-item-unit">{item.unit}</span>
  {/if}
  {#if item.canBeStale}
    <StaleDataNotice />
  {/if}
{/snippet}

<!--
  The network's map first, and beside it the four numbers that matter most
  as cards, their labels above them; the rest in one quiet row of smaller
  labels and values.
-->
<div class="statistics-panel">
  <figure class="statistics-panel__face">
    <WorldMap nodes={nodesData ?? []} />
    <figcaption class="statistics-panel__face-caption">
      Approximate locations of {locatedNodes} the explorer's node knows of, from their
      public IP addresses, rounded to the city. The bigger the ring, the more nodes.
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
              class:statistics-panel__live--waiting={chain === "waiting"}
              role="status"
              >{#if chain !== "unknown"}{#key newest.height}<span
                    aria-hidden="true"
                    class="statistics-panel__live-dot"
                  ></span>{/key}{chain === "live"
                  ? "Live"
                  : "Waiting for blocks"}{/if}</span
            >
          {/if}</span
        >
        <div class="statistics-panel__statistics-item-value-container">
          {@render valueOf(item, "div")}
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
          {@render valueOf(item, "span")}
        </dd>
      </div>
    {/each}
  </dl>
</div>
