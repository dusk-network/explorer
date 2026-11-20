<script>
  import { visibilityOf } from "$lib/chain-info";
  import { describeCall } from "$lib/contracts";
  import { appStore } from "$lib/stores";
  import "./TransactionType.css";

  export let data;

  /**
   * Which way the transaction went for the account whose page lists it: a
   * transfer then says so, as the web wallet's History does.
   *
   * @type {"in" | "out" | "self" | undefined}
   */
  export let direction = undefined;

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
   * row whose receiver already is the contract names the function alone.
   *
   * @type {boolean}
   */
  export let nameContract = true;

  /**
   * Whether to name the function a call ran. The transaction page has its
   * own row for it.
   *
   * @type {boolean}
   */
  export let showMethod = true;

  /**
   * Plain words for a transaction that calls no contract.
   *
   * @type {Map<string, string>}
   */
  const plainTypes = new Map([
    ["blob", "Data blob"],
    ["deploy", "Contract deployed"],
    ["transfer", "Transfer"],
  ]);

  /** @type {Record<"in" | "out" | "self", string>} */
  const directionWords = {
    in: "Received",
    out: "Sent",
    self: "Sent to itself",
  };

  $: visibility = visibilityOf(data);
  $: transferDirection =
    !data.contract && data.method === "transfer" ? direction : undefined;

  // What the transaction did, said once: a call's plain words alone, as
  // "Claim rewards"; else the contract's name and the function it ran, or
  // the function alone, its icon saying it is a call.
  $: callLabel = data.contract
    ? describeCall(data.contract, data.method, $appStore.nodeInfo.chain_id)
        .then(({ label, name }) => ({
          isPlain: Boolean(label),
          text: label ?? (nameContract ? name : null) ?? "",
        }))
        .catch(() => ({ isPlain: false, text: "" }))
    : Promise.resolve({
        isPlain: true,
        text: plainTypes.get(data.method) ?? data.method,
      });
</script>

<div class="transaction-type">
  {#if showPrivacy}
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
    {#if transferDirection}
      <span class="transaction-type__label transaction-type__direction"
        >{directionWords[transferDirection]}</span
      >
    {:else}
      {#await callLabel then { isPlain, text }}
        {#if text}
          <span class="transaction-type__label">{text}</span>
        {/if}
        {#if !isPlain && showMethod && data.contract && data.method && data.method.toLowerCase() !== text.toLowerCase()}
          {#if text}<span aria-hidden="true">·</span>{/if}
          <code class="transaction-type__method">{data.method}</code>
        {:else if !text && data.contract}
          <span class="transaction-type__label">Contract call</span>
        {/if}
      {/await}
    {/if}
  </span>
</div>
