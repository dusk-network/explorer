<script>
  import { Anchor, CopyButton } from "$lib/dusk/components";
  import { shortId } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";
  import {
    DuskAmount,
    DuskName,
    FullValue,
    ListItem,
    OverviewPanelDetailsItem,
  } from "$lib/components";
  import { getPrimaryName, getSearchedName } from "$lib/dusk-domains";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import { labelOf } from "$lib/network";
  import { appStore } from "$lib/stores";

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
   * The stDUSK the account holds, from staking with Sozu: shown only when
   * there is some.
   *
   * @type {bigint | null}
   */
  export let stakedDusk = null;

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
  $: shortAddress = shortId(accountAddress);

  // What the network's labels call the account, before any primary name.
  $: label = labelOf($appStore.nodeInfo.chain_id, accountAddress);

  // The `.dusk` name the heading gives: the one searched for, or else, for
  // an account the labels don't name, its primary name.
  $: headingName = searchedNameShown.then(
    (searched) =>
      searched ??
      (label ? null : getPrimaryName(accountAddress).catch(() => null))
  );
</script>

<!--
  Whose page it is: its name, or its address short, then the address in full.
  Then what it holds, with its stake with Sozu if any beside its own, and for
  a provisioner, its stake.
-->
<section class="account-overview-panel">
  <!-- As the line above a transaction's or a block's summary. -->
  <p class="account-overview-panel__kind">
    <span aria-hidden="true" class="ledger-bracket">[</span>{isProvisioner
      ? "Provisioner"
      : "Account"}<span aria-hidden="true" class="ledger-bracket">]</span>
  </p>
  <!-- The heading holds only the name or the address; its link sits beside it. -->
  <div class="account-overview-panel__title">
    <h1 class="account-overview-panel__header">
      {#await headingName}
        <span class="account-overview-panel__address">{shortAddress}</span>
      {:then name}
        {#if name}
          {name.name}
        {:else if label}
          {label}
        {:else}
          <span class="account-overview-panel__address">{shortAddress}</span>
        {/if}
      {/await}
    </h1>
    {#await headingName then name}
      {#if name}
        <Anchor
          aria-label="Open {name.name} on Dusk Domains"
          className="primary-name__site"
          data-tooltip-id="main-tooltip"
          data-tooltip-text="Open on Dusk Domains"
          href={name.url}>↗</Anchor
        >
      {/if}
    {/await}
  </div>
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

    <OverviewPanelDetailsItem subtitle="Native stake">
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
      <!-- What the account also staked with Sozu, when it holds stDUSK. -->
      {#if stakedDusk}
        <p class="account-overview-panel__sozu">
          Also staked with Sozu: <span
            class="account-overview-panel__sozu-amount"
            title="{formatDuskExact(stakedDusk)} stDUSK"
            >{formatDusk(stakedDusk)} stDUSK</span
          >
        </p>
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
