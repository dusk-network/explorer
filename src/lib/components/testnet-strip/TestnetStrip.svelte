<script>
  import { getNetworkName, isTestNetwork } from "$lib/network";
  import { appStore } from "$lib/stores";

  import "./TestnetStrip.css";

  $: ({ nodeInfo } = $appStore);
  $: name = getNetworkName(nodeInfo);
</script>

<!-- On a test network the explorer says so at the top, as the bridge and the wallets do. -->
{#if isTestNetwork(nodeInfo)}
  <div class="testnet-strip" role="note">
    {name.charAt(0).toUpperCase()}{name.slice(1)}
    <span aria-hidden="true" class="testnet-strip__separator">·</span>
    Test DUSK has no value
  </div>
{/if}
