<script>
  import { Badge } from "$lib/dusk/components";
  import { summarizeTransaction } from "$lib/chain-info";
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
   * row whose receiver already names the contract says "Contract call".
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
   * @param {Transaction} transaction
   * @returns {"in" | "out" | "self" | undefined}
   */
  const getTransactionDirection = (transaction) => {
    const key = $page.url.searchParams.get("key");
    const { from, to } = summarizeTransaction(transaction);
    const sender = from?.kind === "account" ? from.address : undefined;
    const receiver = to?.kind === "account" ? to.address : undefined;

    if (key === sender && key === receiver) {
      return "self";
    }
    if (key === sender) {
      return "out";
    }
    if (key === receiver) {
      return "in";
    }
    return undefined;
  };

  $: isPublic = data.txtype.toLowerCase() === "moonlight";

  /**
   * What a transaction shows everyone. A shielded call hides its sender and
   * the value it moves, but not the contract it calls or the DUSK it sends
   * to it.
   *
   * @param {Transaction} transaction
   * @param {boolean} isPublicTransaction
   */
  const privacyOf = (transaction, isPublicTransaction) =>
    isPublicTransaction
      ? "Sender, receiver and amount are visible to everyone"
      : !transaction.contract
        ? "Sender, receiver and amount are hidden"
        : transaction.deposit
          ? "Sender and value are hidden. The contract called and the DUSK sent to it are public"
          : "Sender and value are hidden. The contract called is public";

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
      data-tooltip-text={privacyOf(data, isPublic)}
      data-tooltip-place="top"
      data-tooltip-type="info">{isPublic ? "Public" : "Shielded"}</span
    >
  {/if}
  <span class="transaction-type__call">
    {#await callLabel then label}
      <span class="transaction-type__label">{label}</span>
    {/await}
    {#if data.contract}
      <span aria-hidden="true" class="transaction-type__separator">·</span>
      <code class="transaction-type__method">{data.method}</code>
    {/if}
  </span>
  {#if isAccountsPage}
    <Badge
      className="transaction-type__direction-badge"
      text={getTransactionDirection(data) ?? "N/A"}
    />
  {/if}
</div>

<style lang="postcss">
  :global(.transaction-type__direction-badge) {
    min-width: 5.625em;
  }
</style>
