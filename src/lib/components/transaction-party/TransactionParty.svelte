<svelte:options immutable={true} />

<script>
  import {
    formatContractId,
    formatEvmAddress,
  } from "@dusk-network/networks/format";

  import { AppAnchor } from "$lib/components";
  import { bridgeDepositRecipient, describeCall } from "$lib/contracts";
  import { Anchor } from "$lib/dusk/components";
  import { middleEllipsis } from "$lib/dusk/string";
  import { duskEvmAddressUrl, labelOf } from "$lib/network";
  import { appStore } from "$lib/stores";

  import "./TransactionParty.css";

  /**
   * A transaction's sender or receiver, as `summarizeTransaction` gives it.
   *
   * @type {import("$lib/chain-info/summarizeTransaction").TransactionParty | null}
   */
  export let party;

  /**
   * How many characters of an address or a contract's ID to show on each
   * side of the ellipsis.
   *
   * @type {number}
   */
  export let chars = 6;

  /**
   * The account's verified primary name, shown instead of its address.
   *
   * @type {{ name: string, url: string } | null | undefined}
   */
  export let name = undefined;

  /**
   * Whether a contract with no name says "Contract" before its ID. A phone's
   * row shows the ID alone, as an address, its type line saying it is a
   * contract call.
   *
   * @type {boolean}
   */
  export let contractWord = true;

  /**
   * The transaction, to show who a deposit to DuskEVM pays instead of the
   * bridge: its call data says, at no cost. The address opens on DuskEVM's
   * own explorer.
   *
   * @type {Transaction | undefined}
   */
  export let transaction = undefined;

  $: chainId = $appStore.nodeInfo.chain_id;

  // An account the network's labels name goes by that name, before any
  // primary name.
  $: shownName =
    party?.kind === "account"
      ? (labelOf(chainId, party.address) ?? name?.name)
      : undefined;
  $: contractName =
    party?.kind === "contract"
      ? describeCall(party.id, "", chainId).then((call) => call.name)
      : Promise.resolve(null);
  $: duskEvmRecipient =
    party?.kind === "contract" && transaction
      ? bridgeDepositRecipient(transaction, chainId)
      : null;
</script>

<!-- A contract with no name: its ID short, after "Contract" or alone. -->
{#snippet unnamed(/** @type {string} */ id)}
  {#if contractWord}Contract {id}{:else}<span
      class="transaction-party__contract-id">{id}</span
    >{/if}
{/snippet}

{#if party?.kind === "account" && shownName}
  <AppAnchor
    className="transaction-party transaction-party--named chain-link"
    data-tooltip-id="main-tooltip"
    data-tooltip-text="{shownName} · {middleEllipsis(party.address, chars)}"
    href="/accounts/?key={party.address}">{shownName}</AppAnchor
  >
{:else if party?.kind === "account"}
  <AppAnchor
    className="transaction-party transaction-party--account chain-link"
    href="/accounts/?key={party.address}"
    >{middleEllipsis(party.address, chars)}</AppAnchor
  >
{:else if party?.kind === "contract" && duskEvmRecipient}
  {@const href = duskEvmAddressUrl(duskEvmRecipient, chainId)}
  {@const short = formatEvmAddress(duskEvmRecipient, { short: true })}
  <span
    class="transaction-party transaction-party--evm"
    data-tooltip-id="main-tooltip"
    data-tooltip-text="{duskEvmRecipient} on DuskEVM"
    >{#if href}<Anchor
        aria-label="{duskEvmRecipient} on the DuskEVM explorer"
        className="transaction-party__evm-address chain-link"
        {href}>{short}</Anchor
      >{:else}<span class="transaction-party__evm-address">{short}</span>{/if}
    <span>on DuskEVM</span></span
  >
{:else if party?.kind === "contract"}
  {@const id = middleEllipsis(formatContractId(party.id), chars)}
  <span
    class="transaction-party transaction-party--contract"
    data-tooltip-id="main-tooltip"
    data-tooltip-text="Contract {party.id}"
    >{#await contractName}{@render unnamed(
        id
      )}{:then known}{#if known}{known}{:else}{@render unnamed(
          id
        )}{/if}{/await}</span
  >
{:else if party?.kind === "shielded"}
  <span class="transaction-party transaction-party--hidden">Shielded</span>
{:else}
  <span class="transaction-party transaction-party--hidden">—</span>
{/if}
