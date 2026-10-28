<svelte:options immutable={true} />

<script>
  import { BlocksList, BlocksTable, DataCard } from "$lib/components";
  import { makeClassName } from "$lib/dusk/string";

  /** @type {string | Undefined} */
  export let className = undefined;

  /** @type {Block[]}*/
  export let blocks;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {boolean} */
  export let isSmallScreen;

  $: classes = makeClassName(["latest-blocks-card", className]);
</script>

<DataCard
  on:retry
  data={blocks}
  {error}
  {loading}
  className={classes}
  title="Blocks"
  variant="section"
  headerLink={{ href: "/blocks", label: "All blocks" }}
>
  {#if isSmallScreen}
    {#each blocks as block (block)}
      <BlocksList data={block} />
    {/each}
  {:else}
    <BlocksTable
      data={blocks}
      className="latest-blocks-card__table"
      showGas={false}
    />
  {/if}
</DataCard>
