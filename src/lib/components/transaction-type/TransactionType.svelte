<script>
  import { directionOf, visibilityOf } from "$lib/chain-info";
  import { describeCall } from "$lib/contracts";
  import { appStore } from "$lib/stores";
  import "./TransactionType.css";
  import { page } from "$app/stores";

  export let data;

  /** @type {boolean} */
  export let displayTooltips = false;

  /**
   * Whether to say "Public" or "Shielded". Tables leave it out: their
   * From / To column already shows what a shielded transaction hides.
   *
   * @type {boolean}
   */
  export let showPrivacy = true;

  /**
   * Whether a call with no plain words for it is named by its contract. A
   * row whose receiver already is the contract says "Contract call".
   *
   * @type {boolean}
   */
  export let nameContract = true;

  const isAccountsPage = $page.url.pathname.includes("accounts");

  /**
   * Plain words for a transaction that calls no contract.
   *
   * @type {Map<string, string>}
   */
  const plainTypes = new Map([
    ["blob", "Blob"],
    ["deploy", "Contract deployed"],
    ["transfer", "Transfer"],
  ]);

  /**
   * On an account's page, a transfer says which way it went for the
   * account, as the web wallet's History does.
   *
   * @type {Record<"in" | "out" | "self", string>}
   */
  const directionWords = {
    in: "Received",
    out: "Sent",
    self: "Sent to itself",
  };

  $: visibility = visibilityOf(data);
  $: direction =
    isAccountsPage && !data.contract && data.method === "transfer"
      ? directionOf(data, $page.url.searchParams.get("key"))
      : undefined;

  // A call shows plain words, or the contract's name, beside its method.
  $: callLabel = data.contract
    ? describeCall(data.contract, data.method, $appStore.nodeInfo.chain_id)
        .then(
          ({ label, name }) =>
            label ?? (nameContract ? name : null) ?? "Contract call"
        )
        .catch(() => "Contract call")
    : Promise.resolve(plainTypes.get(data.method) ?? data.method);
</script>

<div class="transaction-type">
  {#if showPrivacy && !isAccountsPage}
    <span
      class="transaction-type__privacy"
      data-tooltip-disabled={!displayTooltips}
      data-tooltip-id="main-tooltip"
      data-tooltip-text={visibility.seen}
      data-tooltip-place="top"
      data-tooltip-type="info">{visibility.label}</span
    >
  {/if}
  <span class="transaction-type__call">
    {#if direction}
      <span class="transaction-type__label transaction-type__direction"
        >{directionWords[direction]}</span
      >
    {:else}
      {#await callLabel then label}
        <span class="transaction-type__label">{label}</span>
      {/await}
    {/if}
    {#if data.contract}
      <span aria-hidden="true" class="transaction-type__separator">·</span>
      <code class="transaction-type__method">{data.method}</code>
    {/if}
  </span>
</div>
