<script>
  import { isTestNetwork } from "$lib/network";
  import { appStore } from "$lib/stores";

  import "./TestnetStrip.css";

  $: ({ nodeInfo } = $appStore);
</script>

<!--
  On a test network the explorer says so at the top, as the bridge and the
  wallets do; the network's name is the pill's, beside the search.
-->
{#if isTestNetwork(nodeInfo)}
  <div class="testnet-strip" role="note">Test DUSK has no value</div>
{/if}
