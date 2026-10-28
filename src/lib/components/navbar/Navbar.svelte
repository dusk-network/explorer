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
  import { isConnected, networkLabel } from "$lib/network";
  import {
    currentPage,
    goto,
    searchPagePath,
    searchQueryOf,
  } from "$lib/navigation";
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

  /**
   * Whether an element takes typed text.
   *
   * @param {EventTarget | null} target
   */
  const isField = (target) => {
    const element = /** @type {HTMLElement | null} */ (target);

    return Boolean(
      element?.isContentEditable ||
      element?.matches?.(
        "textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])"
      )
    );
  };

  /** @param {FocusEvent} event */
  function handleFocusIn(event) {
    typing = isField(event.target);
  }

  /**
   * "/" puts the cursor in the search, unless something is typed in a
   * field: then it is the character typed.
   *
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (
      event.key !== "/" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      event.defaultPrevented ||
      isField(event.target)
    ) {
      return;
    }

    event.preventDefault();
    searchField?.focus();
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

  /**
   * The query of the search page a search that found nothing is opening,
   * until that navigation lands.
   *
   * @type {string | null}
   */
  let opening = null;

  /**
   * A search that found nothing: its notice, and the search page's address
   * in place of the page searched from, so that a reload or a shared link
   * searches again. From one search to the next, the page searched from
   * stays the one before.
   *
   * @param {{ query: string, res: Error, suggestion?: string }} miss
   */
  function showMiss(miss) {
    const shown = searchQueryOf($page.url);

    notificationData = miss;
    showSearchNotification = true;
    createEmptySpace();

    if (shown !== miss.query) {
      opening = miss.query;
      // A later navigation cancels it, as closing the notice first does.
      goto(searchPagePath(miss.query), {
        keepFocus: true,
        noScroll: true,
        replaceState: shown !== null,
        state: {
          searchedInApp: shown === null || !!$page.state?.searchedInApp,
        },
      }).catch(() => {});
    }
  }

  /**
   * Closes a search's notice: back to the page searched from, or to the
   * home page when the search page was the first one opened. Closed before
   * the search page's address comes, it stays on the page, in its place,
   * which cancels the search page's navigation.
   */
  function closeMiss() {
    if (searchQueryOf($page.url) !== null) {
      if ($page.state?.searchedInApp) {
        history.back();
      } else {
        goto("/", { replaceState: true });
      }

      return;
    }

    showSearchNotification = false;

    if (opening !== null) {
      opening = null;
      goto($page.url.href, {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
        state: $page.state,
      }).catch(() => {});
    }
  }

  afterNavigate(({ to }) => {
    const query = searchQueryOf(to?.url);

    opening = null;

    if (query === null) {
      showSearchNotification = false;
      // A search still in flight was for the page left behind.
      searchField?.cancel();
    } else if (
      query &&
      !(showSearchNotification && notificationData?.query === query)
    ) {
      // The search page, reloaded or reached through the history.
      searchField?.search(query);
    }
  });

  $: ({ nodeInfo } = $appStore);
  $: connected = isConnected(nodeInfo);
  $: networkName = networkLabel(nodeInfo);
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
  on:keydown={handleKeydown}
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
      on:invalid={(e) => showMiss(e.detail)}
    />

    {#if showSearchNotification}
      <SearchNotification
        data={notificationData}
        on:close={closeMiss}
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
    {networkName}
  </span>
</nav>
