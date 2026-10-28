<svelte:options immutable={true} />

<script>
  import { get } from "svelte/store";
  import { BlocksList, BlocksTable, DataCard } from "$lib/components";
  import { Button } from "$lib/dusk/components";
  import { appStore } from "$lib/stores";

  /** @type {Block[] | null}*/
  export let blocks;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {boolean} */
  export let isSmallScreen;

  const ITEMS_TO_DISPLAY = get(appStore).chainInfoEntries;

  let itemsToDisplay = ITEMS_TO_DISPLAY;

  /** @type {Block[]}*/
  let displayedBlocks;

  $: displayedBlocks = blocks ? blocks.slice(0, itemsToDisplay) : [];
  $: hasMore = Boolean(blocks && itemsToDisplay < blocks.length);

  const loadMoreItems = () => {
    if (blocks && itemsToDisplay < blocks.length) {
      itemsToDisplay += ITEMS_TO_DISPLAY;
    }
  };
</script>

<DataCard on:retry data={blocks} {error} {loading} title="Blocks">
  {#if isSmallScreen}
    <div class="data-card__list">
      {#each displayedBlocks as block (block)}
        <BlocksList data={block} />
      {/each}
    </div>
  {:else}
    <BlocksTable data={displayedBlocks} className="data-card__table" />
  {/if}
  <svelte:fragment slot="footer">
    <span class="data-card__count"
      >{displayedBlocks.length} of {blocks?.length ?? 0}</span
    >
    {#if hasMore}
      <Button on:click={loadMoreItems} text="Show more" variant="secondary" />
    {/if}
  </svelte:fragment>
</DataCard>
