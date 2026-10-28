<script>
  import { onMount } from "svelte";

  import { Toast, Tooltip } from "$lib/dusk/components";
  import { Footer, Navbar, TestnetStrip } from "$lib/components";
  import { appStore } from "$lib/stores";
  import { duskAPI } from "$lib/services";
  import "../style/main.css";

  onMount(async () => {
    appStore.setNodeInfo(await duskAPI.getNodeInfo());
  });

  appStore.subscribe(({ darkMode }) => {
    document.documentElement.classList.toggle("dark", darkMode);
  });

  const { hasTouchSupport } = $appStore;

  /**
   * Whether the last search found nothing: its notice stands in for the
   * page, so the previous result can't pass for its answer.
   */
  let hasSearchMissed = false;
</script>

<header>
  <TestnetStrip />
  <Navbar
    on:searchMiss={(e) => {
      hasSearchMissed = e.detail;
    }}
  />
</header>
<main hidden={hasSearchMissed} id="explorer">
  <slot />
</main>
<footer>
  <Footer />
</footer>

<Tooltip defaultDelayShow={hasTouchSupport ? 0 : undefined} id="main-tooltip" />
<Toast />
