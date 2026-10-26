<script>
  import { onMount } from "svelte";
  import { CopyButton } from "$lib/dusk/components";
  import { calculateAdaptiveCharCount, middleEllipsis } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";
  import { addressCharPropertiesDefaults } from "$lib/constants";
  import {
    DuskAmount,
    DuskName,
    OverviewPanelDetailsItem,
  } from "$lib/components";
  import { PrimaryName } from "$lib/containers";
  import { getPrimaryName, getSearchedName } from "$lib/dusk-domains";
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";

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

  /** @type {number} */
  let screenWidth = window.innerWidth;

  const formatter = createValueFormatter("en");

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      screenWidth = entry.contentRect.width;
    });

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  });

  const { minScreenWidth, maxScreenWidth, minCharCount, maxCharCount } =
    addressCharPropertiesDefaults;

  $: shortAddress = middleEllipsis(
    accountAddress,
    calculateAdaptiveCharCount(
      screenWidth,
      minScreenWidth,
      maxScreenWidth,
      minCharCount,
      maxCharCount
    )
  );
</script>

<section class="account-overview-panel">
  <div class="account-overview-panel__address-wrapper">
    <p class="account-overview-panel__header">
      Account:
      {#await searchedNameShown}
        <b class="account-overview-panel__address">{shortAddress}</b>
      {:then searched}
        {#if searched}
          <DuskName address={accountAddress} name={searched} />
        {:else}
          <PrimaryName address={accountAddress}>
            <b class="account-overview-panel__address">{shortAddress}</b>
          </PrimaryName>
        {/if}
      {/await}
    </p>

    <CopyButton
      name="Account address"
      rawValue={accountAddress}
      variant="secondary"
    />
  </div>
  {#await primaryNameShown then primary}
    {#if primary}
      <p class="account-overview-panel__searched-name">
        Primary name: <DuskName name={primary} />
      </p>
    {/if}
  {/await}

  <hr class="account-overview-panel__separator" />
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
        <p>Loading...</p>
      {/if}
    </OverviewPanelDetailsItem>

    <OverviewPanelDetailsItem subtitle="Stake">
      {#if errorFetchingStake}
        <p>N/A</p>
      {:else if stake !== undefined}
        <DuskAmount
          className="account-overview-panel__balance"
          lux={(stake?.active ?? 0) + (stake?.inactive ?? 0)}
        />
      {:else}
        <p>Loading...</p>
      {/if}
    </OverviewPanelDetailsItem>

    <OverviewPanelDetailsItem subtitle="Stake rewards">
      {#if errorFetchingStake}
        <p>N/A</p>
      {:else if stake !== undefined}
        <DuskAmount
          className="account-overview-panel__balance"
          lux={stake?.reward ?? 0}
        />
      {:else}
        <p>Loading...</p>
      {/if}
    </OverviewPanelDetailsItem>
  </div>

  {#if stake && (stake.active || stake.inactive)}
    <p class="account-overview-panel__note account-overview-panel__stake">
      Active <span title="{formatDuskExact(stake.active)} DUSK"
        >{formatDusk(stake.active)} DUSK</span
      >
      · Inactive
      <span title="{formatDuskExact(stake.inactive)} DUSK"
        >{formatDusk(stake.inactive)} DUSK</span
      >
      · Eligible from block {formatter(stake.eligibility)} · Slashes: {stake.faults}
      soft, {stake.hardFaults} hard
    </p>
  {/if}

  <p class="account-overview-panel__note">
    Everything on this page is public: names, public balance, stake and
    transactions. Shielded funds aren't shown.
  </p>
</section>

<style lang="postcss">
  .account-overview-panel__address-wrapper {
    display: flex;
    align-items: center;
    gap: var(--small-gap);
  }

  :global {
    .account-overview-panel__details {
      letter-spacing: 8%;
      line-height: 120%;
    }

    .account-overview-panel__balance {
      max-width: fit-content;
      cursor: help;
    }
  }
</style>
