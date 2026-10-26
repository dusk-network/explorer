<script>
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { mdiClose, mdiMenu } from "@mdi/js";
  import { afterNavigate } from "$app/navigation";

  import { Badge, Button, NavList } from "$lib/dusk/components";
  import { AppAnchor, AppImage, SearchNotification } from "$lib/components";
  import { SearchField } from "$lib/containers";
  import { getNetworkName, isConnected } from "$lib/network";
  import { appStore } from "$lib/stores";

  import "./Navbar.css";

  /** @type {number} */
  let offset;

  /** @type {boolean} */
  let hidden = true;

  /** @type {boolean} */
  let showSearchNotification = false;

  /** @type {*} */
  let notificationData;

  /** @type {SearchField} */
  let searchField;

  let navigation = [
    {
      link: "/",
      title: "Chain Info",
    },
    {
      link: "/blocks",
      title: "Blocks",
    },
    {
      link: "/transactions",
      title: "Transactions",
    },
    {
      link: "/provisioners",
      title: "Provisioners",
    },
  ];

  $: if (import.meta.env.VITE_FEATURE_TOKENS === "true") {
    navigation.push({ link: "/tokens", title: "Tokens" });
    navigation = navigation;
  }

  const dispatch = createEventDispatcher();

  /** @type {ResizeObserver | undefined} */
  let notificationObserver;

  const getNotification = () =>
    document.getElementsByClassName(
      "dusk-navbar__menu--search-notification"
    )[0];

  /**
   * Room below the navbar for the search notification, where it floats
   * over the page (wide screens).
   */
  function updateOffset() {
    const notification = getNotification();

    offset =
      notification && getComputedStyle(notification).position === "absolute"
        ? notification.clientHeight
        : 0;
  }

  /**
   * Makes that room, and keeps it right while the notification shows: its
   * size can change, and so can the viewport, across the width where the
   * notification starts floating.
   */
  async function createEmptySpace() {
    await tick();

    const notification = getNotification();

    notificationObserver?.disconnect();

    if (notification) {
      notificationObserver = new ResizeObserver(updateOffset);
      notificationObserver.observe(notification);
      notificationObserver.observe(document.documentElement);
    }

    updateOffset();
  }

  $: if (!showSearchNotification) {
    notificationObserver?.disconnect();
  }

  onDestroy(() => notificationObserver?.disconnect());

  afterNavigate(() => {
    hidden = true;
    dispatch("toggleMenu", hidden);
    showSearchNotification = false;
  });

  $: ({ darkMode, nodeInfo } = $appStore);
</script>

<nav
  style={showSearchNotification
    ? `margin-bottom: ${offset}px`
    : "margin-bottom: 0"}
  class="dusk-navbar"
  class:dusk-navbar--menu-hidden={hidden}
>
  <AppAnchor href="/" className="dusk-navbar__logo">
    <AppImage
      src={darkMode ? "/dusk_logo_light.svg" : "/dusk_logo.svg"}
      alt="Dusk Logo"
      sizes="(max-width: 1024px) 86px, 129px"
    />
    <span class="dusk-navbar__app-label">Explorer</span>
  </AppAnchor>
  <Button
    aria-controls="dusk-navbar-menu"
    aria-label="Toggle Menu"
    aria-expanded={!hidden}
    className="dusk-navbar__toggle"
    icon={{ path: hidden ? mdiMenu : mdiClose, size: "large" }}
    on:click={() => {
      hidden = !hidden;
      dispatch("toggleMenu", hidden);
    }}
  />
  <div
    class="dusk-navbar__menu"
    class:dusk-navbar__menu--hidden={hidden}
    id="dusk-navbar-menu"
  >
    <Badge
      className="dusk-navbar__menu--network"
      text={isConnected(nodeInfo) ? getNetworkName(nodeInfo) : "unknown"}
      variant={isConnected(nodeInfo) ? "success" : "warning"}
    />
    <NavList className="dusk-navbar__menu--links" {navigation} />
  </div>
  <div class="dusk-navbar__search">
    <SearchField
      bind:this={searchField}
      on:invalid={(e) => {
        notificationData = e.detail;
        showSearchNotification = true;
        createEmptySpace();
      }}
    />

    {#if showSearchNotification}
      <SearchNotification
        data={notificationData}
        on:close={() => {
          showSearchNotification = false;
        }}
        on:suggest={(e) => {
          showSearchNotification = false;
          searchField.search(e.detail);
        }}
        className="dusk-navbar__menu--search-notification"
      />
    {/if}
  </div>
</nav>
