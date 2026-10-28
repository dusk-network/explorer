<script>
  import { isTestNetwork, networkLabel } from "$lib/network";
  import { appStore } from "$lib/stores";

  import "./TestnetStrip.css";

  $: ({ nodeInfo } = $appStore);
  $: name = networkLabel(nodeInfo);
</script>

<!-- On a test network the explorer says so at the top, as the bridge and the wallets do. -->
{#if isTestNetwork(nodeInfo)}
  <div class="testnet-strip" role="note">
    {name}
    <span aria-hidden="true" class="testnet-strip__separator">·</span>
    Test DUSK has no value
  </div>
{/if}
