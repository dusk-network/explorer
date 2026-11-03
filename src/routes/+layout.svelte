<script>
  import { onMount } from "svelte";

  import { Toast, Tooltip } from "$lib/dusk/components";
  import { Footer, Navbar, TestnetStrip } from "$lib/components";
  import { appStore } from "$lib/stores";
  import { nodeAnswers } from "$lib/network";
  import { duskAPI } from "$lib/services";
  import "../style/main.css";

  /** How often the node is asked if it's there while the tab shows, in ms. */
  const NODE_CHECK_INTERVAL = 60_000;

  const askNode = () =>
    duskAPI.getNodeInfo().then(
      (nodeInfo) => {
        nodeAnswers.set(true);

        // Only what changed: all that's drawn from the store draws again.
        if (JSON.stringify(nodeInfo) !== JSON.stringify($appStore.nodeInfo)) {
          appStore.setNodeInfo(nodeInfo);
        }
      },
      () => {
        nodeAnswers.set(false);
      }
    );

  const askNodeIfShown = () => {
    if (!document.hidden) {
      askNode();
    }
  };

  onMount(() => {
    // A link from the old address arrives marked, so that a browser's
    // remembered redirect from before the move can't send it round in a
    // circle. Here, the mark has done its job.
    const url = new URL(window.location.href);

    if (url.searchParams.has("moved")) {
      url.searchParams.delete("moved");
      window.history.replaceState(window.history.state, "", url);
    }

    askNode();

    const timer = setInterval(askNodeIfShown, NODE_CHECK_INTERVAL);

    document.addEventListener("visibilitychange", askNodeIfShown);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", askNodeIfShown);
    };
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
