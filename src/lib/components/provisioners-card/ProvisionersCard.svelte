<svelte:options immutable={true} />

<script>
  import { get } from "svelte/store";
  import {
    DataCard,
    ProvisionersList,
    ProvisionersTable,
  } from "$lib/components";
  import { Button, Textbox } from "$lib/dusk/components";
  import { appStore } from "$lib/stores";

  import "./ProvisionersCard.css";

  /** @type {HostProvisioner[] | null}*/
  export let provisioners;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {boolean} */
  export let isSmallScreen;

  const ITEMS_TO_DISPLAY = get(appStore).chainInfoEntries;

  let itemsToDisplay = ITEMS_TO_DISPLAY;

  /** @type {string} */
  let query = "";

  /**
   * @typedef {HostProvisioner & {
   *   rank: number;
   *   ownerType: string;
   *   ownerAddress: string;
   *   hasSeparateOwner: boolean;
   * }} EnrichedProvisioner
   */

  /** @param {HostProvisioner} p */
  const hasActiveStake = (p) =>
    p.amount !== 0 || p.locked_amt !== 0 || p.eligibility !== 0;

  /**
   * Reduce callback, filters inactive + enriches owner fields.
   * @param {EnrichedProvisioner[]} acc
   * @param {HostProvisioner} p
   * @returns {EnrichedProvisioner[]}
   */
  const toEnrichedProvisioner = (acc, p) => {
    if (!hasActiveStake(p)) return acc;

    const [ownerType, ownerAddress] = Object.entries(p.owner ?? {})[0] ?? [
      "",
      "",
    ];

    const hasSeparateOwner = Boolean(ownerAddress) && ownerAddress !== p.key;

    acc.push({
      ...p,
      hasSeparateOwner,
      ownerAddress,
      ownerType,
      rank: 0,
    });

    return acc;
  };

  /**
   * Whether a provisioner's staking or owner address contains the query.
   *
   * @param {EnrichedProvisioner} p
   * @param {string} search
   */
  const matches = (p, search) =>
    p.key.toLowerCase().includes(search) ||
    p.ownerAddress.toLowerCase().includes(search);

  /** @type {EnrichedProvisioner[]} */
  $: enrichedProvisioners = Array.isArray(provisioners)
    ? provisioners
        .reduce(
          toEnrichedProvisioner,
          /** @type {EnrichedProvisioner[]} */ ([])
        )
        .toSorted((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
        .map((p, index) => ({
          ...p,
          rank: index + 1,
        }))
    : [];

  $: search = query.trim().toLowerCase();
  $: foundProvisioners = search
    ? enrichedProvisioners.filter((p) => matches(p, search))
    : enrichedProvisioners;
  $: displayedProvisioners = foundProvisioners.slice(0, itemsToDisplay);
  $: hasMore = itemsToDisplay < foundProvisioners.length;

  const loadMoreItems = () => {
    if (itemsToDisplay < foundProvisioners.length) {
      itemsToDisplay += ITEMS_TO_DISPLAY;
    }
  };
</script>

<DataCard on:retry data={provisioners} {error} {loading} title="Provisioners">
  <div class="provisioners-card__search">
    <Textbox
      aria-label="Search provisioners by staking or owner address"
      bind:value={query}
      placeholder="Staking or owner address"
      type="search"
    />
  </div>
  {#if !displayedProvisioners.length}
    <p class="provisioners-card__empty">
      No provisioner has an address with “{query.trim()}”.
    </p>
  {:else if isSmallScreen}
    <div class="data-card__list">
      {#each displayedProvisioners as provisioner (provisioner)}
        <ProvisionersList data={provisioner} displayTooltips={true} />
      {/each}
    </div>
  {:else}
    <ProvisionersTable
      data={displayedProvisioners}
      className="data-card__table"
    />
  {/if}
  <svelte:fragment slot="footer">
    <span class="data-card__count"
      >{displayedProvisioners.length} of {foundProvisioners.length}</span
    >
    {#if hasMore}
      <Button on:click={loadMoreItems} text="Show More" variant="tertiary" />
    {/if}
  </svelte:fragment>
</DataCard>
