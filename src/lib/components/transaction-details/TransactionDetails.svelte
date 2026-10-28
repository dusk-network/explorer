<svelte:options immutable={true} />

<script>
  import { onMount } from "svelte";
  import { Card, CopyButton, RelativeTime, Switch } from "$lib/dusk/components";
  import { createValueFormatter } from "$lib/dusk/value";
  import {
    createFeeFormatter,
    createFiatFormatter,
    luxToDusk,
  } from "$lib/dusk/currency";
  import {
    calculateAdaptiveCharCount,
    hexToText,
    makeClassName,
    middleEllipsis,
  } from "$lib/dusk/string";
  import {
    AppAnchor,
    DataCard,
    DataGuard,
    ListItem,
    StaleDataNotice,
    TransactionStatus,
    TransactionType,
  } from "$lib/components";
  import { PrimaryName } from "$lib/containers";
  import { addressCharPropertiesDefaults } from "$lib/constants";
  import { summarizeTransaction } from "$lib/chain-info";
  import { describeCall } from "$lib/contracts";

  import "./TransactionDetails.css";

  /** @type {string | Undefined} */
  export let className = undefined;

  /** @type {Transaction} */
  export let data;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {MarketData | null} */
  export let market;

  const formatter = createValueFormatter("en");
  const duskFormatter = createFeeFormatter("en");
  const fiatFormatter = createFiatFormatter("en", "usd");

  const { minScreenWidth, maxScreenWidth, minCharCount, maxCharCount } =
    addressCharPropertiesDefaults;

  /** From this width up, IDs and addresses show in full. */
  const FULL_VALUES_MIN_WIDTH = 1024;

  /** @type {number} */
  let screenWidth = window.innerWidth;

  /** @type {boolean} */
  let isPayloadToggled = false;

  /** @type {boolean} */
  let isMemoHex = false;

  /** @param {string} value */
  const shorten = (value) =>
    screenWidth >= FULL_VALUES_MIN_WIDTH
      ? value
      : middleEllipsis(
          value,
          calculateAdaptiveCharCount(
            screenWidth,
            minScreenWidth,
            maxScreenWidth,
            minCharCount,
            maxCharCount
          )
        );

  /**
   * An amount in DUSK, with its value in dollars when the price is known.
   *
   * @param {number} lux
   */
  const toDuskAndUsd = (lux) => {
    const dusk = luxToDusk(lux);
    const price = market?.currentPrice.usd;

    return price === undefined
      ? `${duskFormatter(dusk)} DUSK`
      : `${duskFormatter(dusk)} DUSK (${fiatFormatter(dusk * price)})`;
  };

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      screenWidth = entry.contentRect.width;
    });

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  });

  $: classes = makeClassName(["transaction-details", className]);

  // The card shows the details only once there is data.
  $: ({ amount, from, to } = data
    ? summarizeTransaction(data)
    : { amount: null, from: null, to: null });
  $: memoText = data ? hexToText(data.memo) : null;
  $: contractName = data?.contract
    ? describeCall(data.contract, data.method).then(({ name }) => name)
    : Promise.resolve(null);
</script>

<DataCard
  on:retry
  {data}
  {error}
  {loading}
  className={classes}
  title="Transaction Details"
>
  <dl class="transaction-details__list">
    <!-- TRANSACTION ID -->
    <ListItem tooltipText="The ID of the transaction">
      <svelte:fragment slot="term">ID</svelte:fragment>
      <svelte:fragment slot="definition">
        <AppAnchor
          className="transaction-details__list-anchor"
          href="/transactions/transaction?id={data.txid}"
          >{shorten(data.txid)}</AppAnchor
        >
        <CopyButton rawValue={data.txid} name="Transaction ID" />
      </svelte:fragment>
    </ListItem>

    <!-- STATUS -->
    <ListItem tooltipText="The transaction status">
      <svelte:fragment slot="term">status</svelte:fragment>
      <svelte:fragment slot="definition"
        ><TransactionStatus
          className="transaction-details__status explorer-badge"
          errorMessage={data.txerror}
          showErrorTooltip={true}
        /></svelte:fragment
      >
    </ListItem>

    <!-- FROM -->
    {#if from}
      <ListItem tooltipText="The sender of the transaction">
        <svelte:fragment slot="term">from</svelte:fragment>
        <svelte:fragment slot="definition">
          {#if from.kind === "account"}
            <PrimaryName
              address={from.address}
              href="/accounts/?key={from.address}"
            >
              <AppAnchor
                className="transaction-details__list-anchor"
                href="/accounts/?key={from.address}"
                >{shorten(from.address)}</AppAnchor
              >
            </PrimaryName>
            <CopyButton rawValue={from.address} name="Sender's address" />
          {:else}
            <span class="transaction-details__hidden">Shielded</span>
          {/if}
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- TO -->
    {#if to?.kind === "account"}
      <ListItem tooltipText="The receiver of the transaction">
        <svelte:fragment slot="term">to</svelte:fragment>
        <svelte:fragment slot="definition">
          <PrimaryName address={to.address} href="/accounts/?key={to.address}">
            <AppAnchor
              className="transaction-details__list-anchor"
              href="/accounts/?key={to.address}"
              >{shorten(to.address)}</AppAnchor
            >
          </PrimaryName>
          <CopyButton rawValue={to.address} name="Receiver's address" />
        </svelte:fragment>
      </ListItem>
    {:else if to?.kind === "shielded"}
      <ListItem tooltipText="The receiver of the transaction">
        <svelte:fragment slot="term">to</svelte:fragment>
        <span class="transaction-details__hidden" slot="definition"
          >Shielded</span
        >
      </ListItem>
    {/if}

    <!-- CONTRACT -->
    {#if data.contract}
      <ListItem tooltipText="The contract the transaction called">
        <svelte:fragment slot="term">contract</svelte:fragment>
        <svelte:fragment slot="definition">
          <span class="transaction-details__contract">
            {#await contractName then name}
              {#if name}
                <span class="transaction-details__contract-name">{name}</span>
              {/if}
            {/await}
            <span class="transaction-details__contract-id"
              >{shorten(data.contract)}</span
            >
          </span>
          <CopyButton rawValue={data.contract} name="Contract ID" />
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- AMOUNT -->
    <ListItem
      tooltipText="The DUSK sent to the receiver, or to the contract it called"
    >
      <svelte:fragment slot="term">amount</svelte:fragment>
      <svelte:fragment slot="definition">
        {#if amount?.kind === "shielded"}
          <span class="transaction-details__hidden">Shielded</span>
        {:else if amount}
          {toDuskAndUsd(amount.lux)}
          <StaleDataNotice />
        {/if}
      </svelte:fragment>
    </ListItem>

    <!-- DEPOSIT, when a transfer also sends DUSK to a contract -->
    {#if amount?.kind === "value" && amount.lux && data.deposit}
      <ListItem tooltipText="The DUSK sent to the contract it called">
        <svelte:fragment slot="term">deposit</svelte:fragment>
        <svelte:fragment slot="definition">
          {toDuskAndUsd(data.deposit)}
          <StaleDataNotice />
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- TRANSACTION FEE -->
    <ListItem tooltipText="The fee paid for the transaction">
      <svelte:fragment slot="term">transaction fee</svelte:fragment>
      <svelte:fragment slot="definition">
        {toDuskAndUsd(data.feepaid)}
        <StaleDataNotice />
      </svelte:fragment>
    </ListItem>

    <!-- TIMESTAMP -->
    <ListItem tooltipText="The date and time the transaction was created">
      <svelte:fragment slot="term">timestamp</svelte:fragment>
      <RelativeTime
        autoRefresh={true}
        className="transaction-details__list-timestamp"
        date={data.date}
        slot="definition"
        ><svelte:fragment let:relativeTime
          >{`${data.date.toUTCString()} (${relativeTime})`}</svelte:fragment
        ></RelativeTime
      >
    </ListItem>

    <!-- TYPE -->
    <ListItem tooltipText="The transaction type">
      <svelte:fragment slot="term">type</svelte:fragment>
      <svelte:fragment slot="definition">
        <TransactionType {data} displayTooltips={true} />
      </svelte:fragment>
    </ListItem>

    <!-- MEMO -->
    <ListItem tooltipText="Transaction reference and additional notes">
      <svelte:fragment slot="term">memo</svelte:fragment>
      <svelte:fragment slot="definition">
        <DataGuard data={data.memo}>
          <span class="transaction-details__memo"
            >{memoText === null || isMemoHex ? data.memo : memoText}</span
          >
          {#if memoText !== null}
            <span class="transaction-details__memo-toggle">
              <span aria-hidden="true">Hex</span>
              <Switch
                aria-label="Show memo as hex"
                onSurface={true}
                bind:value={isMemoHex}
              />
            </span>
          {/if}
        </DataGuard>
      </svelte:fragment>
    </ListItem>

    <!-- BLOCK HEIGHT -->
    <ListItem tooltipText="The block height this transaction belongs to">
      <svelte:fragment slot="term">block height</svelte:fragment>
      <svelte:fragment slot="definition">
        <AppAnchor
          className="transaction-details__list-anchor"
          href="/blocks/block?id={data.blockhash}"
          >{formatter(data.blockheight)}</AppAnchor
        ></svelte:fragment
      >
    </ListItem>

    <!-- GAS PRICE -->
    <ListItem
      tooltipText="The transaction gas price, in LUX (1 DUSK = 1,000,000,000 LUX)"
    >
      <svelte:fragment slot="term">gas price</svelte:fragment>
      <svelte:fragment slot="definition"
        >{formatter(data.gasprice)} LUX</svelte:fragment
      >
    </ListItem>

    <!-- GAS LIMIT -->
    <ListItem tooltipText="The transaction gas limit">
      <svelte:fragment slot="term">transaction gas limit</svelte:fragment>
      <svelte:fragment slot="definition"
        >{formatter(data.gaslimit)}</svelte:fragment
      >
    </ListItem>

    <!-- GAS SPENT -->
    <ListItem tooltipText="The amount of gas spent generating the transaction">
      <svelte:fragment slot="term">gas spent</svelte:fragment>
      <svelte:fragment slot="definition"
        >{formatter(data.gasspent)}</svelte:fragment
      >
    </ListItem>

    <!-- NONCE -->
    {#if data.txtype.toLowerCase() === "moonlight" && data.nonce}
      <ListItem tooltipText="The number of transactions sent from this address">
        <svelte:fragment slot="term">nonce</svelte:fragment>
        <svelte:fragment slot="definition">{data.nonce}</svelte:fragment>
      </ListItem>
    {/if}

    <!-- PAYLOAD -->
    <ListItem tooltipText="The transaction payload">
      <svelte:fragment slot="term">
        <div class="transaction-details__switch-wrapper">
          payload
          <Switch
            aria-label="Show payload"
            className="transaction-details__payload-switch"
            onSurface={true}
            bind:value={isPayloadToggled}
          />
        </div>
      </svelte:fragment>

      <svelte:fragment slot="definition">
        {#if isPayloadToggled}
          <Card onSurface={true} className="transaction-details__payload">
            <pre>{data.payload
                ? JSON.stringify(data.payload, null, 2)
                : "---"}</pre>
          </Card>
        {/if}
      </svelte:fragment>
    </ListItem>

    {#if data.blobHashes.length}
      <!-- BLOB HASHES -->
      <ListItem tooltipText="The list of blob hashes">
        <svelte:fragment slot="term">Blob hashes</svelte:fragment>
        <svelte:fragment slot="definition">
          <ul class="transaction-details__blob-hashes">
            {#each data.blobHashes as blobHash (blobHash)}
              <li class="transaction-details__blob-hash">
                <pre>{shorten(blobHash)}</pre>
                <CopyButton rawValue={blobHash} name="Blob hash" />
              </li>
            {/each}
          </ul>
        </svelte:fragment>
      </ListItem>
    {/if}
  </dl>
</DataCard>
