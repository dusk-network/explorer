<script>
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import {
    mdiAccountGroupOutline,
    mdiCircleMultipleOutline,
    mdiCubeOutline,
    mdiHomeOutline,
    mdiSwapHorizontal,
  } from "@mdi/js";
  import { afterNavigate } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/stores";

  import { NavList } from "$lib/dusk/components";
  import {
    DUSK_WORDMARK_GLYPH,
    DUSK_WORDMARK_LETTERS,
    DUSK_WORDMARK_VIEW_BOX,
  } from "$lib/dusk/icons";
  import { AppAnchor, SearchNotification } from "$lib/components";
  import { SearchField } from "$lib/containers";
  import { getNetworkName, isConnected } from "$lib/network";
  import { currentPage } from "$lib/navigation";
  import { appStore } from "$lib/stores";

  import "./Navbar.css";

  /** @type {number} */
  let offset;

  /** @type {boolean} */
  let showSearchNotification = false;

  /** @type {*} */
  let notificationData;

  /** @type {SearchField} */
  let searchField;

  /**
   * Whether a text field has the focus: on a phone the pages bar then
   * makes way for the keyboard.
   */
  let typing = false;

  /** @type {NavListProp} */
  let navigation = [
    { icon: mdiHomeOutline, link: "/", title: "Home" },
    { icon: mdiCubeOutline, link: "/blocks", title: "Blocks" },
    { icon: mdiSwapHorizontal, link: "/transactions", title: "Transactions" },
    {
      icon: mdiAccountGroupOutline,
      link: "/provisioners",
      title: "Provisioners",
    },
  ];

  $: if (import.meta.env.VITE_FEATURE_TOKENS === "true") {
    navigation.push({
      icon: mdiCircleMultipleOutline,
      link: "/tokens",
      title: "Tokens",
    });
    navigation = navigation;
  }

  /** @param {FocusEvent} event */
  function handleFocusIn(event) {
    const target = /** @type {HTMLElement | null} */ (event.target);

    typing = Boolean(
      target?.matches?.(
        "textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])"
      )
    );
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

  // A search that found nothing replaces the page below until it is closed.
  $: dispatch("searchMiss", showSearchNotification);

  onDestroy(() => notificationObserver?.disconnect());

  afterNavigate(() => {
    showSearchNotification = false;
    // A search still in flight was for the page left behind.
    searchField?.cancel();
  });

  $: ({ nodeInfo } = $appStore);
  $: connected = isConnected(nodeInfo);
  $: networkName = connected ? getNetworkName(nodeInfo) : "unknown";
  $: current = currentPage(
    $page.url.pathname,
    navigation.map(({ link }) => link),
    base
  );
</script>

<svelte:window
  on:focusin={handleFocusIn}
  on:focusout={() => {
    typing = false;
  }}
/>

<nav
  style={showSearchNotification
    ? `margin-bottom: ${offset}px`
    : "margin-bottom: 0"}
  class="dusk-navbar"
  class:dusk-navbar--typing={typing}
>
  <AppAnchor
    aria-label="Dusk Explorer, home"
    className="dusk-navbar__brand"
    href="/"
  >
    <!-- The Dusk wordmark, a thin line and the app's name, as the wallet's. -->
    <svg
      aria-hidden="true"
      class="dusk-navbar__wordmark"
      viewBox={DUSK_WORDMARK_VIEW_BOX}
    >
      <path d={DUSK_WORDMARK_GLYPH} fill-rule="evenodd" />
      <path d={DUSK_WORDMARK_LETTERS} />
    </svg>
    <span aria-hidden="true" class="dusk-navbar__divider"></span>
    <span class="dusk-navbar__app-label">Explorer</span>
  </AppAnchor>

  <NavList
    aria-label="Explorer pages"
    className="dusk-navbar__pages"
    {current}
    {navigation}
  />

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

  <!-- The network, and a dot that says whether its node answered. -->
  <span class="dusk-navbar__network">
    <span
      aria-hidden="true"
      class="dusk-navbar__network-dot"
      class:dusk-navbar__network-dot--online={connected}
    ></span>
    {networkName.charAt(0).toUpperCase()}{networkName.slice(1)}
  </span>
</nav>
