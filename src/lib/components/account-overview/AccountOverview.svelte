<script>
  import { onMount } from "svelte";
  import { CopyButton } from "$lib/dusk/components";
  import { calculateAdaptiveCharCount, middleEllipsis } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";
  import { addressCharPropertiesDefaults } from "$lib/constants";
  import { DuskName, OverviewPanelDetailsItem } from "$lib/components";
  import { PrimaryName } from "$lib/containers";
  import { getPrimaryName, getSearchedName } from "$lib/dusk-domains";
  import { luxToDusk } from "$lib/dusk/currency";

  import "./AccountOverview.css";

  export let accountAddress;
  export let errorFetchingAccountStatus;
  export let accountBalance;

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
  const fixedNumberFormatter = createValueFormatter("en", 2, 2);

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
    <OverviewPanelDetailsItem subtitle="Current Balance">
      {#if errorFetchingAccountStatus}
        <p>N/A</p>
      {:else if accountBalance !== undefined}
        {@const formatted = fixedNumberFormatter(luxToDusk(accountBalance))}
        {@const parts = formatted.split(".")}
        <p
          class="account-overview-panel__balance"
          data-tooltip-id="main-tooltip"
          data-tooltip-place="right"
          data-tooltip-type="info"
          data-tooltip-text="{formatter(luxToDusk(accountBalance))} DUSK"
        >
          {parts[0]}.<span class="decimal-shadow">{parts[1]}</span> DUSK
        </p>
      {:else}
        <p>Loading...</p>
      {/if}
    </OverviewPanelDetailsItem>
  </div>
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
