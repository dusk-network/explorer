<svelte:options immutable={true} />

<script>
  import { mdiAlertCircleOutline, mdiCheck } from "@mdi/js";

  import { CopyButton, Icon, Switch } from "$lib/dusk/components";
  import { createValueFormatter } from "$lib/dusk/value";
  import {
    createFiatFormatter,
    formatDuskExact,
    luxToDusk,
  } from "$lib/dusk/currency";
  import { formatDateTime } from "$lib/dusk/date";
  import { hexToText, makeClassName, middleEllipsis } from "$lib/dusk/string";
  import {
    AppAnchor,
    DataCard,
    FullValue,
    ListItem,
    StaleDataNotice,
    TransactionIcon,
    TransactionType,
  } from "$lib/components";
  import { PrimaryName } from "$lib/containers";
  import { describeTransaction, summarizeTransaction } from "$lib/chain-info";
  import { bridgeDepositRecipient, describeCall } from "$lib/contracts";
  import { getPrimaryName } from "$lib/dusk-domains";
  import { appStore } from "$lib/stores";

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
  const fiatFormatter = createFiatFormatter("en", "usd");

  /** @type {boolean} */
  let isPayloadToggled = false;

  /** @type {boolean} */
  let isMemoHex = false;

  /**
   * An amount in DUSK, every decimal of it, with its value in dollars when
   * the price is known: on mainnet only. The price is an argument, so that
   * an amount shown before the price came gets its dollars when it comes.
   *
   * @param {number} lux
   * @param {number | undefined} price A DUSK's price in dollars
   */
  const toDuskAndUsd = (lux, price) =>
    price === undefined
      ? `${formatDuskExact(lux)} DUSK`
      : `${formatDuskExact(lux)} DUSK (${fiatFormatter(luxToDusk(lux) * price)})`;

  /**
   * A party as the leading sentence names it, at first by its short
   * address: the names come from lookups the rows below make too.
   *
   * @param {import("$lib/chain-info/summarizeTransaction").TransactionParty | null} party
   * @returns {string | null}
   */
  const shortNameOf = (party) =>
    party?.kind === "account"
      ? middleEllipsis(party.address, 6)
      : party?.kind === "contract"
        ? `contract ${middleEllipsis(party.id, 4)}`
        : null;

  /**
   * @param {import("$lib/chain-info/summarizeTransaction").TransactionParty | null} party
   * @param {number | null | undefined} chainId
   * @returns {Promise<string | null>}
   */
  const nameOf = async (party, chainId) => {
    const short = shortNameOf(party);

    if (party?.kind === "account") {
      return getPrimaryName(party.address).then(
        (found) => found?.name ?? short,
        () => short
      );
    }

    if (party?.kind === "contract") {
      return describeCall(party.id, "", chainId).then(
        ({ name }) => name ?? short,
        () => short
      );
    }

    return short;
  };

  $: classes = makeClassName(["transaction-details", "detail-page", className]);
  $: usdPrice = market?.currentPrice.usd;

  // The card shows the details only once there is data.
  $: ({ amount, from, to } = data
    ? summarizeTransaction(data)
    : { amount: null, from: null, to: null });
  $: memoText = data ? hexToText(data.memo) : null;
  $: chainId = $appStore.nodeInfo.chain_id;
  $: contractName = data?.contract
    ? describeCall(data.contract, data.method, chainId).then(({ name }) => name)
    : Promise.resolve(null);

  // Who a deposit to DuskEVM pays, from its call data.
  $: duskEvmRecipient = data
    ? bridgeDepositRecipient(data, chainId).catch(() => null)
    : Promise.resolve(null);
  $: shortLead = data
    ? describeTransaction(data, {
        from: shortNameOf(from),
        to: shortNameOf(to),
      })
    : "";
  $: lead = data
    ? Promise.all([
        nameOf(from, chainId),
        nameOf(to, chainId),
        duskEvmRecipient,
      ]).then(([fromName, toName, duskEvm]) =>
        describeTransaction(data, {
          duskEvm: duskEvm && `${duskEvm.slice(0, 6)}...${duskEvm.slice(-4)}`,
          from: fromName,
          to: toName,
        })
      )
    : Promise.resolve("");
</script>

<DataCard
  on:retry
  {data}
  {error}
  {loading}
  className={classes}
  title="Transaction"
  variant="detail"
>
  <!-- Who sent how much to whom, whether it went through, and when. -->
  <div class="transaction-details__summary detail-summary">
    <TransactionIcon transaction={data} />
    <p class="transaction-details__summary-lines detail-summary__lines">
      <span class="transaction-details__summary-text detail-summary__text"
        >{#await lead}{shortLead}{:then sentence}{sentence}{/await}</span
      >
      <span class="transaction-details__summary-meta detail-summary__meta">
        <span
          class="transaction-details__outcome"
          class:transaction-details__summary-failed={!!data.txerror}
          data-tooltip-id={data.txerror ? "main-tooltip" : undefined}
          data-tooltip-text={data.txerror || undefined}
          data-tooltip-type="error"
          ><Icon
            path={data.txerror ? mdiAlertCircleOutline : mdiCheck}
          />{data.txerror ? "Failed" : "Completed"}</span
        >
        <span aria-hidden="true">·</span>
        {formatDateTime(data.date)}
      </span>
    </p>
  </div>

  <dl class="transaction-details__list detail-rows">
    <!-- TRANSACTION ID -->
    <ListItem wide>
      <svelte:fragment slot="term">ID</svelte:fragment>
      <svelte:fragment slot="definition">
        <span class="transaction-details__value">
          <AppAnchor
            className="transaction-details__list-anchor"
            href="/transactions/transaction?id={data.txid}"
            ><FullValue value={data.txid} /></AppAnchor
          >
        </span>
        <CopyButton
          name="Transaction ID"
          rawValue={data.txid}
          text="Copy"
          variant="secondary"
        />
      </svelte:fragment>
    </ListItem>

    <!-- FROM -->
    {#if from}
      <ListItem wide={from.kind === "account"}>
        <svelte:fragment slot="term">From</svelte:fragment>
        <svelte:fragment slot="definition">
          {#if from.kind === "account"}
            <span class="transaction-details__value">
              <PrimaryName
                address={from.address}
                href="/accounts/?key={from.address}"
                showAddress={false}
              />
              <AppAnchor
                className="transaction-details__list-anchor"
                href="/accounts/?key={from.address}"
                ><FullValue value={from.address} /></AppAnchor
              >
            </span>
            <CopyButton
              name="Sender's address"
              rawValue={from.address}
              text="Copy"
              variant="secondary"
            />
          {:else}
            <span class="transaction-details__hidden">Shielded</span>
          {/if}
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- TO -->
    {#await duskEvmRecipient then duskEvm}
      {#if duskEvm}
        <ListItem wide>
          <svelte:fragment slot="term">To</svelte:fragment>
          <svelte:fragment slot="definition">
            <span class="transaction-details__value transaction-details__evm"
              ><span class="transaction-details__evm-address"
                ><FullValue ends={6} value={duskEvm} /></span
              > on DuskEVM</span
            >
            <CopyButton
              name="DuskEVM address"
              rawValue={duskEvm}
              text="Copy"
              variant="secondary"
            />
          </svelte:fragment>
        </ListItem>
      {/if}
    {/await}
    {#if to?.kind === "account"}
      <ListItem wide>
        <svelte:fragment slot="term">To</svelte:fragment>
        <svelte:fragment slot="definition">
          <span class="transaction-details__value">
            <PrimaryName
              address={to.address}
              href="/accounts/?key={to.address}"
              showAddress={false}
            />
            <AppAnchor
              className="transaction-details__list-anchor"
              href="/accounts/?key={to.address}"
              ><FullValue value={to.address} /></AppAnchor
            >
          </span>
          <CopyButton
            name="Receiver's address"
            rawValue={to.address}
            text="Copy"
            variant="secondary"
          />
        </svelte:fragment>
      </ListItem>
    {:else if to?.kind === "shielded"}
      <ListItem>
        <svelte:fragment slot="term">To</svelte:fragment>
        <span class="transaction-details__hidden" slot="definition"
          >Shielded</span
        >
      </ListItem>
    {/if}

    <!-- CONTRACT -->
    {#if data.contract}
      <ListItem wide>
        <svelte:fragment slot="term">Contract</svelte:fragment>
        <svelte:fragment slot="definition">
          <span
            class="transaction-details__value transaction-details__contract"
          >
            {#await contractName then name}
              {#if name}
                <span class="transaction-details__contract-name">{name}</span>
              {/if}
            {/await}
            <span class="transaction-details__contract-id"
              ><FullValue value={data.contract} /></span
            >
          </span>
          <CopyButton
            name="Contract ID"
            rawValue={data.contract}
            text="Copy"
            variant="secondary"
          />
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- AMOUNT -->
    <ListItem>
      <svelte:fragment slot="term">Amount</svelte:fragment>
      <svelte:fragment slot="definition">
        {#if amount?.kind === "shielded"}
          <span class="transaction-details__hidden">Shielded</span>
        {:else if amount}
          {toDuskAndUsd(amount.lux, usdPrice)}
          <StaleDataNotice />
        {/if}
      </svelte:fragment>
    </ListItem>

    <!-- DEPOSIT, when a transfer also sends DUSK to a contract -->
    {#if amount?.kind === "value" && amount.lux && data.deposit}
      <ListItem
        tooltipText="The DUSK the transfer also sent to the contract it called"
      >
        <svelte:fragment slot="term">Deposit</svelte:fragment>
        <svelte:fragment slot="definition">
          {toDuskAndUsd(data.deposit, usdPrice)}
          <StaleDataNotice />
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- TRANSACTION FEE -->
    <ListItem>
      <svelte:fragment slot="term">Transaction fee</svelte:fragment>
      <svelte:fragment slot="definition">
        {toDuskAndUsd(data.feepaid, usdPrice)}
        <StaleDataNotice />
      </svelte:fragment>
    </ListItem>

    <!-- TYPE -->
    <ListItem>
      <svelte:fragment slot="term">Type</svelte:fragment>
      <svelte:fragment slot="definition">
        <TransactionType {data} displayTooltips={true} />
      </svelte:fragment>
    </ListItem>

    <!-- MEMO, when there is one -->
    {#if data.memo}
      <ListItem>
        <svelte:fragment slot="term">Memo</svelte:fragment>
        <svelte:fragment slot="definition">
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
        </svelte:fragment>
      </ListItem>
    {/if}

    <!-- BLOCK HEIGHT -->
    <ListItem>
      <svelte:fragment slot="term">Block height</svelte:fragment>
      <svelte:fragment slot="definition">
        <AppAnchor
          className="transaction-details__block-link"
          href="/blocks/block?id={data.blockhash}"
          >{formatter(data.blockheight)}</AppAnchor
        ></svelte:fragment
      >
    </ListItem>
  </dl>

  <!-- Gas, the nonce and the payload, for those who want them. -->
  <details class="transaction-details__technical detail-technical">
    <summary
      class="transaction-details__technical-summary detail-technical__summary"
      >Technical details</summary
    >
    <dl class="transaction-details__list detail-rows">
      <!-- GAS PRICE -->
      <ListItem
        tooltipText="The transaction gas price, in LUX (1 DUSK = 1,000,000,000 LUX)"
      >
        <svelte:fragment slot="term">Gas price</svelte:fragment>
        <svelte:fragment slot="definition"
          >{formatter(data.gasprice)} LUX</svelte:fragment
        >
      </ListItem>

      <!-- GAS LIMIT -->
      <ListItem
        tooltipText="The most gas the transaction could use. Only the gas spent is paid for"
      >
        <svelte:fragment slot="term">Transaction gas limit</svelte:fragment>
        <svelte:fragment slot="definition"
          >{formatter(data.gaslimit)}</svelte:fragment
        >
      </ListItem>

      <!-- GAS SPENT -->
      <ListItem>
        <svelte:fragment slot="term">Gas spent</svelte:fragment>
        <svelte:fragment slot="definition"
          >{formatter(data.gasspent)}</svelte:fragment
        >
      </ListItem>

      <!-- NONCE -->
      {#if data.txtype.toLowerCase() === "moonlight" && data.nonce}
        <ListItem
          tooltipText="The number of transactions sent from this address"
        >
          <svelte:fragment slot="term">Nonce</svelte:fragment>
          <svelte:fragment slot="definition">{data.nonce}</svelte:fragment>
        </ListItem>
      {/if}

      <!-- PAYLOAD, when there is one -->
      {#if data.payload}
        <ListItem wide>
          <svelte:fragment slot="term">
            <span class="transaction-details__switch-wrapper detail-switch">
              Payload
              <Switch
                aria-label="Show payload"
                className="transaction-details__payload-switch"
                onSurface={true}
                bind:value={isPayloadToggled}
              />
            </span>
          </svelte:fragment>

          <svelte:fragment slot="definition">
            {#if isPayloadToggled}
              <pre
                class="transaction-details__payload detail-payload">{JSON.stringify(
                  data.payload,
                  null,
                  2
                )}</pre>
            {/if}
          </svelte:fragment>
        </ListItem>
      {/if}

      {#if data.blobHashes.length}
        <!-- BLOB HASHES -->
        <ListItem wide>
          <svelte:fragment slot="term">Blob hashes</svelte:fragment>
          <svelte:fragment slot="definition">
            <ul class="transaction-details__blob-hashes">
              {#each data.blobHashes as blobHash (blobHash)}
                <li class="transaction-details__blob-hash">
                  <FullValue value={blobHash} />
                  <CopyButton
                    name="Blob hash"
                    rawValue={blobHash}
                    text="Copy"
                    variant="secondary"
                  />
                </li>
              {/each}
            </ul>
          </svelte:fragment>
        </ListItem>
      {/if}

      {#if data.txerror}
        <!-- ERROR -->
        <ListItem wide>
          <svelte:fragment slot="term">Error</svelte:fragment>
          <code class="transaction-details__error" slot="definition"
            >{data.txerror}</code
          >
        </ListItem>
      {/if}
    </dl>
  </details>
</DataCard>
