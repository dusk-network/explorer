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
  import { formatDateTime } from "$lib/dusk/date";
  import { getRelativeTimeString } from "$lib/dusk/string";
  import { duskIcon } from "$lib/dusk/icons";
  import { Icon } from "$lib/dusk/components";
  import { DataGuard, StaleDataNotice, WorldMap } from "$lib/components";
  import { isMainnet } from "$lib/network";
  import {
    appStore,
    chainHeadStore,
    chainStatsStore,
    marketDataStore,
    nodeLocationStore,
  } from "$lib/stores";

  import "./StatisticsPanel.css";

  const valueFormatter = createCurrencyFormatter("en", "DUSK", 0);
  const millionFormatter = createCompactFormatter("en");

  /**
   * @param { number | bigint } value
   */
  const formatter = (value) => {
    return value >= 1e6 ? millionFormatter(value) : valueFormatter(value);
  };

  /** No new block for this long, and the page says it waits for one. */
  const WAITING_AFTER = 30_000;

  /** The time, to the second, to tell how long ago the newest block came. */
  let now = Date.now();

  /** @type {ReturnType<typeof setInterval> | undefined} */
  let clock;

  onMount(() => {
    clock = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(clock);
  });

  $: ({ data: marketData } = $marketDataStore);
  $: ({ data: statsData, error: statsError } = $chainStatsStore);
  $: ({ head: newest } = $chainHeadStore);
  $: ({ data: nodesData } = $nodeLocationStore);

  // The node locates the nodes it knows of, each by its public IP address,
  // to the city; the map groups them by city.
  $: located = nodesData?.reduce((sum, { count }) => sum + count, 0) ?? 0;
  $: locatedNodes =
    located === 1 ? "1 node" : located ? `${located} nodes` : "the nodes";

  /**
   * Live while new blocks come, waiting once the newest one came over 30
   * seconds ago; nothing said while the last block can't be read, or
   * hasn't been yet. A block heard as it came came then; one read on
   * opening, or after a gap, came at its own time, no later than then: a
   * chain that stopped meanwhile isn't live.
   *
   * @type {"live" | "waiting" | "unknown"}
   */
  $: chain =
    statsError || !newest
      ? "unknown"
      : now - newest.at < WAITING_AFTER
        ? "live"
        : "waiting";

  /**
   * A line under a number that says more about it, and maybe more after it,
   * each part kept whole: on a phone, one to a line. A price's move says
   * which way it went.
   *
   * @typedef {{ more: string | null, text: string, way: "down" | "up" | null }} Note
   */

  /**
   * How the price moved over 24 hours, or `null` while that is unknown.
   *
   * @param {number | null | undefined} change In percent
   * @returns {Note | null}
   */
  function priceMove(change) {
    if (typeof change !== "number" || !Number.isFinite(change)) {
      return null;
    }

    const percent = Math.abs(change).toFixed(2);

    if (percent === "0.00") {
      return { more: null, text: "Unchanged in 24h", way: null };
    }

    return change < 0
      ? { more: null, text: `Down ${percent}% in 24h`, way: "down" }
      : { more: null, text: `Up ${percent}% in 24h`, way: "up" };
  }

  /**
   * @typedef {{
   *   approximate: boolean,
   *   attributes: Record<string, string> | null,
   *   canBeStale: boolean,
   *   compact: boolean | null,
   *   data: any,
   *   icon: string,
   *   note: Note | null,
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
    note: null,
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
    currentStake: {
      ...stakeStatistic("Current stake", statsData?.activeStake),
      // Its share of the DUSK in circulation, on mainnet: the market data
      // brings that.
      note:
        statsData?.activeStake && marketData?.circulatingSupply
          ? {
              more: null,
              text: `${((luxToDusk(statsData.activeStake) / marketData.circulatingSupply) * 100).toFixed(1)}% of circulating supply`,
              way: null,
            }
          : null,
    },
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
      note: priceMove(marketData?.priceChange24h),
      prefix: "$",
    }),
    totalTransactions: statistic(
      "Total transactions",
      statsData?.txCount?.total,
      {
        icon: mdiSwapVertical,
        note: statsData?.txCount
          ? {
              more: `${valueFormatter(statsData.txCount.shielded)} shielded`,
              text: `${valueFormatter(statsData.txCount.public)} public`,
              way: null,
            }
          : null,
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
  as cards, each under its label with a line that says more; the rest in one
  quiet card of smaller labels and values, under the four on wide screens.
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
              >{#if chain !== "unknown"}{#key newest?.height}<span
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
        {#if key === "lastBlock"}
          <!-- How long ago the last block was made, by its own time, never ahead of now; as the status, nothing while it can't be read. -->
          {#if chain !== "unknown" && newest}
            <time
              class="statistics-panel__statistics-item-note"
              data-tooltip-id="main-tooltip"
              data-tooltip-text={formatDateTime(newest.date)}
              datetime={newest.date.toISOString()}
              >{getRelativeTimeString(
                new Date(Math.min(newest.date.getTime(), now)),
                "long"
              )}</time
            >
          {/if}
        {:else if item.note}
          <span
            class="statistics-panel__statistics-item-note"
            class:statistics-panel__statistics-item-note--down={item.note
              .way === "down"}
            class:statistics-panel__statistics-item-note--up={item.note.way ===
              "up"}
          >
            <span class="statistics-panel__statistics-item-note-part"
              >{item.note.text}</span
            >
            {#if item.note.more}
              <span class="statistics-panel__statistics-item-note-part"
                ><span
                  aria-hidden="true"
                  class="statistics-panel__statistics-item-note-dot">·</span
                >
                {item.note.more}</span
              >
            {/if}
          </span>
        {/if}
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
