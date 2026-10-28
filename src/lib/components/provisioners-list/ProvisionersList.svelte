<svelte:options immutable={true} />

<script>
  import { formatContractId } from "@dusk-network/networks/format";

  import { CopyButton } from "$lib/dusk/components";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { makeClassName, middleEllipsis } from "$lib/dusk/string";
  import { AppAnchor, DetailList, ListItem } from "$lib/components";
  import { labelOf } from "$lib/network";
  import { appStore } from "$lib/stores";

  import "./ProvisionersList.css";

  /** @type {EnrichedProvisioner} */
  export let data;

  /** Lists show an address as its first and last six characters. */
  const ADDRESS_CHARS = 6;

  $: ownerLabel = labelOf($appStore.nodeInfo.chain_id, data.ownerAddress);
</script>

<DetailList className="provisioners-list">
  <ListItem>
    <svelte:fragment slot="term">Provisioner</svelte:fragment>
    <svelte:fragment slot="definition">
      <span class="provisioners-list__rank">#{data.rank}</span>
      <AppAnchor
        className="provisioners-list__staking-address chain-link"
        href="/accounts/?key={data.key}"
        >{middleEllipsis(data.key, ADDRESS_CHARS)}</AppAnchor
      >
      <CopyButton name="Staking address" rawValue={data.key} />
    </svelte:fragment>
  </ListItem>

  <ListItem
    tooltipText="Active stake takes part in consensus. Inactive stake doesn't."
  >
    <svelte:fragment slot="term">Stake</svelte:fragment>
    <svelte:fragment slot="definition">
      <span>
        <span title="{formatDuskExact(data.amount)} DUSK"
          >{formatDusk(data.amount)} DUSK</span
        >
        {#if data.locked_amt}
          <span
            class="provisioners-list__muted"
            title="{formatDuskExact(data.locked_amt)} DUSK"
            >+ {formatDusk(data.locked_amt)} inactive</span
          >
        {/if}
      </span>
    </svelte:fragment>
  </ListItem>

  <ListItem tooltipText="The rewards not yet claimed">
    <svelte:fragment slot="term">Reward</svelte:fragment>
    <svelte:fragment slot="definition">
      <span title="{formatDuskExact(data.reward)} DUSK"
        >{formatDusk(data.reward)} DUSK</span
      >
    </svelte:fragment>
  </ListItem>

  <ListItem
    tooltipText="Soft slashes for missed duties, hard slashes for faults"
  >
    <svelte:fragment slot="term">Slashes</svelte:fragment>
    <svelte:fragment slot="definition">
      {data.faults} soft, {data.hard_faults} hard
    </svelte:fragment>
  </ListItem>

  {#if data.hasSeparateOwner}
    <ListItem
      tooltipText="The key that owns the stake, when it isn't the staking key"
    >
      <svelte:fragment slot="term">Owner</svelte:fragment>
      <svelte:fragment slot="definition">
        {#if data.ownerType === "Account"}
          <AppAnchor
            className={makeClassName([
              !ownerLabel && "provisioners-list__staking-address",
              "chain-link",
            ])}
            href="/accounts/?key={data.ownerAddress}"
            >{ownerLabel ??
              middleEllipsis(data.ownerAddress, ADDRESS_CHARS)}</AppAnchor
          >
        {:else}
          <span class:provisioners-list__staking-address={!ownerLabel}
            >{ownerLabel ??
              `Contract ${formatContractId(data.ownerAddress, { short: true })}`}</span
          >
        {/if}
      </svelte:fragment>
    </ListItem>
  {/if}
</DetailList>
