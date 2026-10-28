<script>
  import { CopyButton } from "$lib/dusk/components";
  import { middleEllipsis } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";
  import {
    DuskAmount,
    DuskName,
    FullValue,
    ListItem,
    OverviewPanelDetailsItem,
  } from "$lib/components";
  import { PrimaryName } from "$lib/containers";
  import { getPrimaryName, getSearchedName } from "$lib/dusk-domains";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";

  import "./AccountOverview.css";

  export let accountAddress;
  export let errorFetchingAccountStatus;
  export let accountBalance;

  /**
   * The stake of the account's key: `undefined` while it loads and `null`
   * when there is none.
   *
   * @type {AccountStake | null | undefined}
   */
  export let stake = undefined;

  /** @type {boolean} */
  export let errorFetchingStake = false;

  /**
   * The last block, to tell when the stake takes part: `null` until it is
   * known, or when it couldn't be read.
   *
   * @type {{ date: Date, height: number } | null}
   */
  export let tip = null;

  /**
   * The `.dusk` name searched for to reach this account, if any. It leads
   * the header once it resolves to the account, and the account's primary
   * name follows; it shows nothing more when it is the primary name.
   *
   * @type {string | null}
   */
  export let searchedName = null;

  $: searchedNameShown = getSearchedName(searchedName, accountAddress).catch(
    () => null
  );
  $: primaryNameShown = searchedNameShown.then((searched) =>
    searched ? getPrimaryName(accountAddress).catch(() => null) : null
  );

  /** Blocks come every 10 seconds, on mainnet and testnet alike. */
  const BLOCK_MS = 10_000;

  const formatter = createValueFormatter("en");

  /**
   * When a block comes, or came, as the last block and the block time
   * tell.
   *
   * @param {number} height
   * @param {{ date: Date, height: number }} last
   */
  const estimateDate = (height, last) =>
    new Date(last.date.getTime() + (height - last.height) * BLOCK_MS);

  // An account with a stake is a provisioner.
  $: isProvisioner = !!(stake && (stake.active || stake.inactive));

  // As lists show addresses: the first and last six characters.
  $: shortAddress = middleEllipsis(accountAddress, 6);
</script>

<!--
  Whose page it is: its name, or its address short, then the address in full.
  Then what it holds, and for a provisioner, its stake.
-->
<section class="account-overview-panel">
  <p class="account-overview-panel__kind">
    {isProvisioner ? "Provisioner" : "Account"}
  </p>
  <h1 class="account-overview-panel__header">
    {#await searchedNameShown}
      <span class="account-overview-panel__address">{shortAddress}</span>
    {:then searched}
      {#if searched}
        <DuskName name={searched} />
      {:else}
        <PrimaryName address={accountAddress} showAddress={false}>
          <span class="account-overview-panel__address">{shortAddress}</span>
        </PrimaryName>
      {/if}
    {/await}
  </h1>
  {#await primaryNameShown then primary}
    {#if primary}
      <p class="account-overview-panel__searched-name">
        Primary name: <DuskName name={primary} />
      </p>
    {/if}
  {/await}
  <div class="account-overview-panel__address-row">
    <FullValue value={accountAddress} />
    <CopyButton
      name="Account address"
      rawValue={accountAddress}
      text="Copy"
      variant="secondary"
    />
  </div>

  <div class="account-overview-panel__details">
    <OverviewPanelDetailsItem subtitle="Public balance">
      {#if errorFetchingAccountStatus}
        <p>N/A</p>
      {:else if accountBalance !== undefined}
        <DuskAmount
          className="account-overview-panel__balance"
          lux={accountBalance}
        />
      {:else}
        <p class="account-overview-panel__loading">Loading…</p>
      {/if}
    </OverviewPanelDetailsItem>

    <OverviewPanelDetailsItem subtitle="Stake">
      {#if errorFetchingStake}
        <p>N/A</p>
      {:else if stake !== undefined}
        <DuskAmount
          className="account-overview-panel__balance"
          lux={(stake?.active ?? 0n) + (stake?.inactive ?? 0n)}
        />
      {:else}
        <p class="account-overview-panel__loading">Loading…</p>
      {/if}
    </OverviewPanelDetailsItem>

    <OverviewPanelDetailsItem subtitle="Stake rewards">
      {#if errorFetchingStake}
        <p>N/A</p>
      {:else if stake !== undefined}
        <DuskAmount
          className="account-overview-panel__balance"
          lux={stake?.reward ?? 0n}
        />
      {:else}
        <p class="account-overview-panel__loading">Loading…</p>
      {/if}
    </OverviewPanelDetailsItem>
  </div>

  {#if stake && isProvisioner}
    <dl class="account-overview-panel__stake detail-rows">
      <ListItem>
        <svelte:fragment slot="term">Active stake</svelte:fragment>
        <span title="{formatDuskExact(stake.active)} DUSK" slot="definition"
          >{formatDusk(stake.active)} DUSK</span
        >
      </ListItem>
      <ListItem>
        <svelte:fragment slot="term">Inactive stake</svelte:fragment>
        <span title="{formatDuskExact(stake.inactive)} DUSK" slot="definition"
          >{formatDusk(stake.inactive)} DUSK</span
        >
      </ListItem>
      <ListItem
        tooltipText="When the stake takes part in consensus and starts to earn rewards"
      >
        <svelte:fragment slot="term">Eligibility</svelte:fragment>
        <svelte:fragment slot="definition">
          {#if tip}
            <span title="Block {formatter(stake.eligibility)}"
              >{stake.eligibility > tip.height ? "From about" : "Since about"}
              {formatDateTime(estimateDate(stake.eligibility, tip), {
                seconds: false,
              })}</span
            >
          {:else}
            From block {formatter(stake.eligibility)}
          {/if}
        </svelte:fragment>
      </ListItem>
      <ListItem
        tooltipText="Soft slashes for missed duties, hard slashes for faults"
      >
        <svelte:fragment slot="term">Slashes</svelte:fragment>
        <svelte:fragment slot="definition"
          >{stake.faults} soft, {stake.hardFaults} hard</svelte:fragment
        >
      </ListItem>
    </dl>
  {/if}

  <p class="account-overview-panel__note">
    Everything here is public. Shielded funds aren't shown.
  </p>
</section>
