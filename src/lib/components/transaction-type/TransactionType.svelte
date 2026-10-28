<script>
  import { Badge } from "$lib/dusk/components";
  import { summarizeTransaction } from "$lib/chain-info";
  import { describeCall } from "$lib/contracts";
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

  const BADGE_TEXT_MAX_LENGTH = 20;
  const isAccountsPage = $page.url.pathname.includes("accounts");

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

  // Plain words for a common call, beside its method name.
  $: callLabel = data.contract
    ? describeCall(data.contract, data.method).then(({ label }) => label)
    : Promise.resolve(null);
</script>

<div class="transaction-type">
  {#if showPrivacy && !isAccountsPage}
    <span
      class="transaction-type__privacy"
      data-tooltip-disabled={!displayTooltips}
      data-tooltip-id="main-tooltip"
      data-tooltip-text={isPublic
        ? "Sender, receiver and amount are visible to everyone"
        : "Sender, receiver and amount are hidden"}
      data-tooltip-place="top"
      data-tooltip-type="info">{isPublic ? "Public" : "Shielded"}</span
    >
  {/if}
  <Badge
    className="transaction-type__method-badge"
    text={data.method}
    maxlength={BADGE_TEXT_MAX_LENGTH}
  />
  {#if isAccountsPage}
    <Badge
      className="transaction-type__direction-badge"
      text={getTransactionDirection(data) ?? "N/A"}
    />
  {/if}
  {#await callLabel then label}
    {#if label}
      <span class="transaction-type__label">{label}</span>
    {/if}
  {/await}
</div>

<style lang="postcss">
  :global(.transaction-type__method-badge) {
    min-width: 8.125rem;
  }

  :global(.transaction-type__direction-badge) {
    min-width: 5.625em;
  }
</style>
