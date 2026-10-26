<svelte:options immutable={true} />

<script>
  import { onMount } from "svelte";

  import { CopyButton } from "$lib/dusk/components";
  import { luxToDusk } from "$lib/dusk/currency";
  import { createValueFormatter } from "$lib/dusk/value";
  import { calculateAdaptiveCharCount, middleEllipsis } from "$lib/dusk/string";
  import { AppAnchor, DetailList, ListItem } from "$lib/components";

  import "./ProvisionersList.css";

  /**
   * @typedef {HostProvisioner & {
   *   rank: number;
   *   ownerType: string;
   *   ownerAddress: string;
   *   hasSeparateOwner: boolean;
   * }} EnrichedProvisioner
   */

  /** @type {EnrichedProvisioner} */
  export let data;

  /** @type {Boolean} */
  export let displayTooltips = false;

  /** @type {number} */
  let screenWidth = window.innerWidth;

  const duskFormatter = createValueFormatter("en", 2, 2);

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      screenWidth = entry.contentRect.width;
    });

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  });

  $: adaptiveCharCount = calculateAdaptiveCharCount(
    screenWidth,
    320,
    1024,
    4,
    25
  );
  $: provisionerKey = middleEllipsis(data.key, adaptiveCharCount);
</script>

<DetailList className="provisioners-list">
  <!-- RANK AND STAKING ADDRESS -->
  <ListItem
    tooltipText={displayTooltips
      ? "Rank by stake, and the staking address. Open it for its stake and rewards."
      : ""}
  >
    <svelte:fragment slot="term">Provisioner</svelte:fragment>
    <svelte:fragment slot="definition">
      <span class="provisioners-list__rank">#{data.rank}</span>
      <AppAnchor
        className="provisioners-list__staking-address"
        href="/accounts/?key={data.key}">{provisionerKey}</AppAnchor
      >
      <CopyButton
        name="Staking address"
        rawValue={data.key}
        variant="secondary"
      />
    </svelte:fragment>
  </ListItem>

  <!-- STAKE -->
  <ListItem
    tooltipText={displayTooltips
      ? "Active stake takes part in consensus. Inactive stake doesn't."
      : ""}
  >
    <svelte:fragment slot="term">Stake</svelte:fragment>
    <svelte:fragment slot="definition">
      <span>
        {duskFormatter(luxToDusk(data.amount))} DUSK
        {#if data.locked_amt}
          <span class="provisioners-list__muted"
            >+ {duskFormatter(luxToDusk(data.locked_amt))} inactive</span
          >
        {/if}
      </span>
    </svelte:fragment>
  </ListItem>

  <!-- REWARD -->
  <ListItem tooltipText={displayTooltips ? "The rewards not yet claimed" : ""}>
    <svelte:fragment slot="term">Reward</svelte:fragment>
    <svelte:fragment slot="definition">
      {duskFormatter(luxToDusk(data.reward))} DUSK
    </svelte:fragment>
  </ListItem>

  <!-- SLASHES -->
  <ListItem
    tooltipText={displayTooltips
      ? "Soft slashes for missed duties, hard slashes for faults"
      : ""}
  >
    <svelte:fragment slot="term">Slashes</svelte:fragment>
    <svelte:fragment slot="definition">
      {data.faults} soft, {data.hard_faults} hard
    </svelte:fragment>
  </ListItem>

  {#if data.hasSeparateOwner}
    <!-- OWNER -->
    <ListItem
      tooltipText={displayTooltips
        ? "The key that owns the stake, when it isn't the staking key"
        : ""}
    >
      <svelte:fragment slot="term">Owner</svelte:fragment>
      <svelte:fragment slot="definition">
        {#if data.ownerType === "Account"}
          <AppAnchor
            className="provisioners-list__staking-address"
            href="/accounts/?key={data.ownerAddress}"
            >{middleEllipsis(data.ownerAddress, adaptiveCharCount)}</AppAnchor
          >
        {:else}
          <span class="provisioners-list__staking-address"
            >Contract {middleEllipsis(data.ownerAddress, 4)}</span
          >
        {/if}
      </svelte:fragment>
    </ListItem>
  {/if}
</DetailList>
