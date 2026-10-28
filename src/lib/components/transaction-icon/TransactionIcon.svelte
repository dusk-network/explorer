<svelte:options immutable={true} />

<script>
  import {
    mdiArrowBottomLeft,
    mdiArrowTopRight,
    mdiCodeBraces,
    mdiEyeOffOutline,
    mdiLayersOutline,
    mdiSwapHorizontal,
    mdiSync,
  } from "@mdi/js";

  import { Icon } from "$lib/dusk/components";
  import { transactionKind } from "$lib/contracts";
  import { appStore } from "$lib/stores";

  /** @type {Transaction} */
  export let transaction;

  /**
   * On an account's page, which way a transfer went for the account: an
   * arrow out, an arrow in, or a circle for one sent to itself.
   *
   * @type {"in" | "out" | "self" | undefined}
   */
  export let direction = undefined;

  /**
   * The icon of each kind of transaction: what it did, never who it was
   * with, as in the web wallet's History.
   *
   * @type {Record<import("$lib/contracts/transactionKind").TransactionKind, string>}
   */
  const ICONS = {
    bridge: mdiSwapHorizontal,
    call: mdiCodeBraces,
    shielded: mdiEyeOffOutline,
    staking: mdiLayersOutline,
    transfer: mdiArrowTopRight,
  };

  $: kind = transactionKind(transaction, $appStore.nodeInfo.chain_id);
  $: path =
    kind === "transfer" && direction === "in"
      ? mdiArrowBottomLeft
      : kind === "transfer" && direction === "self"
        ? mdiSync
        : ICONS[kind];
</script>

<span aria-hidden="true" class="row-icon"><Icon {path} /></span>
