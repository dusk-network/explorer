import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import * as appNavigation from "$app/navigation";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";
import { resolveDuskName } from "$lib/dusk-domains";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

import { Navbar } from "..";

const { pageStore } = vi.hoisted(() => ({
  /** @type {{ at: (url: string, state?: App.PageState) => void }} */
  pageStore: { at: () => {} },
}));

// The page the navbar is on: its address, and its state in the history.
vi.mock("$app/stores", async (importOriginal) => {
  const { writable } = await import("svelte/store");
  const page = writable({ state: {}, url: new URL("http://localhost/") });

  pageStore.at = (url, state = {}) => page.set({ state, url: new URL(url) });

  return {
    .../** @type {object} */ (await importOriginal()),
    page: { subscribe: page.subscribe },
  };
});

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  resolveDuskName: vi.fn(),
}));

/** The search page's address for a query, as the browser has it. */
const searchPage = (/** @type {string} */ query) =>
  `http://localhost/some-base-path/search/?q=${encodeURIComponent(query)}`;

/** @param {HTMLElement} container */
const getNotificationElement = (container) =>
  container.querySelector(".dusk-navbar__menu--search-notification");

/** @param {HTMLElement} container */
async function showSearchNotification(container) {
  const form = /** @type {HTMLFormElement} */ (container.querySelector("form"));
  const searchInput = /** @type {HTMLInputElement} */ (
    form.querySelector("input[type='text']")
  );

  await fireEvent.input(searchInput, { target: { value: "foo_bar" } }); // invalid search
  await fireEvent.submit(form);
}

describe("Navbar", () => {
  /** @type {(navigation: import("@sveltejs/kit").AfterNavigate) => void} */
  let afterNavigateCallback;

  const afterNavigateSpy = vi
    .spyOn(appNavigation, "afterNavigate")
    .mockImplementation((fn) => {
      afterNavigateCallback = fn;
    });

  afterEach(() => {
    cleanup();
    afterNavigateSpy.mockClear();
    pageStore.at("http://localhost/");

    // A test that failed leaves its spies behind: the next starts without.
    for (const spied of [appNavigation.goto, history.back, duskAPI.search]) {
      if (vi.isMockFunction(spied)) {
        vi.mocked(spied).mockRestore();
      }
    }
  });

  afterAll(() => {
    afterNavigateSpy.mockRestore();
  });

  it("renders the Navbar component", () => {
    const { container } = render(Navbar);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show the Dusk wordmark, a thin line and the app's name, as one link home", () => {
    const { getByRole } = render(Navbar);
    const brand = getByRole("link", { name: "Dusk Explorer, home" });

    expect(brand.querySelector(".dusk-navbar__wordmark")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(brand.querySelector(".dusk-navbar__divider")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(brand).toHaveTextContent(/^Explorer$/);
  });

  it("should mark the page shown among the pages", () => {
    const { getByRole } = render(Navbar);
    const pages = getByRole("navigation", { name: "Explorer pages" });

    // The tests' page is the home page.
    expect(getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      Array.from(pages.querySelectorAll("a"), (link) => [
        link.textContent?.trim(),
        link.getAttribute("aria-current"),
      ])
    ).toStrictEqual([
      ["Home", "page"],
      ["Blocks", null],
      ["Transactions", null],
      ["Provisioners", null],
      ["Tokens", null],
    ]);
  });

  it("should give the network and whether its node answered", async () => {
    const { container } = render(Navbar);
    const network = /** @type {HTMLElement} */ (
      container.querySelector(".dusk-navbar__network")
    );
    const dot = /** @type {HTMLElement} */ (
      network.querySelector(".dusk-navbar__network-dot")
    );

    expect(network).toHaveTextContent(/^Unknown$/);
    expect(dot).not.toHaveClass("dusk-navbar__network-dot--online");

    await act(() => appStore.setNodeInfo(apiNodeInfo));

    expect(network).toHaveTextContent(/^Testnet$/);
    expect(dot).toHaveClass("dusk-navbar__network-dot--online");

    await act(() =>
      // eslint-disable-next-line camelcase
      appStore.setNodeInfo({ ...apiNodeInfo, chain_id: undefined })
    );
  });

  it("should move the phone's pages bar out of the keyboard's way while a field is typed in", async () => {
    const { container, getByRole } = render(Navbar);
    const nav = /** @type {HTMLElement} */ (container.querySelector("nav"));

    expect(nav).not.toHaveClass("dusk-navbar--typing");

    await fireEvent.focusIn(getByRole("textbox"));

    expect(nav).toHaveClass("dusk-navbar--typing");

    await fireEvent.focusOut(getByRole("textbox"));

    expect(nav).not.toHaveClass("dusk-navbar--typing");
  });

  it("should hide the search notification when its close button is clicked", async () => {
    const { container } = render(Navbar);

    expect(getNotificationElement(container)).toBeNull();

    await showSearchNotification(container);

    expect(getNotificationElement(container)).toBeInTheDocument();

    const btnClose = /** @type {HTMLButtonElement} */ (
      container.querySelector(".search-notification__header-action")
    );

    await fireEvent.click(btnClose);

    expect(getNotificationElement(container)).toBeNull();
  });

  it("should hide the search notification after a navigation event", async () => {
    const { container } = render(Navbar);

    expect(getNotificationElement(container)).toBeNull();

    await showSearchNotification(container);

    expect(getNotificationElement(container)).toBeInTheDocument();

    await act(() => {
      afterNavigateCallback(
        /** @type {any} */ ({
          to: { url: new URL("http://localhost/some-base-path/blocks/") },
        })
      );
    });

    expect(getNotificationElement(container)).toBeNull();
  });

  it("should give a search that found nothing the search page's address, in place of the page searched from", async () => {
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    pageStore.at("http://localhost/some-base-path/accounts/?key=abc");

    const { container } = render(Navbar);

    await showSearchNotification(container);

    expect(getNotificationElement(container)).toHaveTextContent(
      "Nothing found for foo_bar"
    );
    // A new entry: Back, or closing the notice, returns to the account.
    expect(gotoSpy).toHaveBeenCalledExactlyOnceWith(
      "/some-base-path/search/?q=foo_bar",
      {
        keepFocus: true,
        noScroll: true,
        replaceState: false,
        state: { searchedInApp: true },
      }
    );

    gotoSpy.mockRestore();
  });

  it("should replace the search page's address with the next search's, keeping the page searched from before it", async () => {
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    /** @param {App.PageState} state */
    const searchAgainOn = async (state) => {
      pageStore.at(searchPage("foo_bar"), state);

      const { container, unmount } = render(Navbar);
      const form = /** @type {HTMLFormElement} */ (
        container.querySelector("form")
      );

      await fireEvent.input(
        /** @type {HTMLInputElement} */ (form.querySelector("input")),
        { target: { value: "bar_baz" } }
      );
      await fireEvent.submit(form);
      unmount();

      return gotoSpy.mock.lastCall;
    };

    for (const searchedInApp of [true, false]) {
      expect(
        await searchAgainOn(searchedInApp ? { searchedInApp } : {})
      ).toStrictEqual([
        "/some-base-path/search/?q=bar_baz",
        {
          keepFocus: true,
          noScroll: true,
          replaceState: true,
          state: { searchedInApp },
        },
      ]);
    }

    gotoSpy.mockRestore();
  });

  it("should search again when the search page is opened by its address, as on a reload", async () => {
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    pageStore.at(searchPage("foo_bar"));

    const { container, getByRole } = render(Navbar);

    await act(() =>
      afterNavigateCallback(
        /** @type {any} */ ({ to: { url: new URL(searchPage("foo_bar")) } })
      )
    );

    expect(getNotificationElement(container)).toHaveTextContent(
      "Nothing found for foo_bar"
    );
    expect(getByRole("textbox")).toHaveValue("foo_bar");
    // Its address already says it.
    expect(gotoSpy).not.toHaveBeenCalled();

    gotoSpy.mockRestore();
  });

  it("should open what a search page's search finds now, in the search page's place", async () => {
    const account = hostProvisioners[0].key;
    const gotoSpy = vi.spyOn(appNavigation, "goto");
    const searchSpy = vi
      .spyOn(duskAPI, "search")
      .mockResolvedValueOnce({ id: account, type: "account" });

    pageStore.at(searchPage(account));
    render(Navbar);

    await act(() =>
      afterNavigateCallback(
        /** @type {any} */ ({ to: { url: new URL(searchPage(account)) } })
      )
    );

    await vi.waitFor(() =>
      expect(gotoSpy).toHaveBeenCalledExactlyOnceWith(
        `/some-base-path/accounts/?key=${account}`,
        { replaceState: true }
      )
    );

    searchSpy.mockRestore();
    gotoSpy.mockRestore();
  });

  it("should not search again for the search page a search that found nothing just opened", async () => {
    const searchSpy = vi.spyOn(duskAPI, "search").mockResolvedValue(null);
    const { container, getByRole } = render(Navbar);
    const input = getByRole("textbox");

    await fireEvent.input(input, { target: { value: "foobar" } });
    await fireEvent.submit(
      /** @type {HTMLFormElement} */ (input.closest("form"))
    );
    await vi.waitFor(() =>
      expect(getNotificationElement(container)).toHaveTextContent(
        "Nothing found for foobar"
      )
    );

    pageStore.at(searchPage("foobar"), { searchedInApp: true });
    await act(() =>
      afterNavigateCallback(
        /** @type {any} */ ({ to: { url: new URL(searchPage("foobar")) } })
      )
    );

    expect(getNotificationElement(container)).toHaveTextContent(
      "Nothing found for foobar"
    );
    expect(searchSpy).toHaveBeenCalledExactlyOnceWith("foobar");

    searchSpy.mockRestore();
  });

  it("should open the .dusk name the search page's notice suggests in that page's place", async () => {
    const account = hostProvisioners[0].key;
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    vi.mocked(resolveDuskName).mockResolvedValueOnce(account);
    pageStore.at(searchPage("alice"), { searchedInApp: true });

    const { getByRole } = render(Navbar);

    // The search page, opened: it searches again and offers alice.dusk.
    await act(() =>
      afterNavigateCallback(
        /** @type {any} */ ({ to: { url: new URL(searchPage("alice")) } })
      )
    );
    await fireEvent.click(
      await vi.waitFor(() => getByRole("button", { name: "Search alice.dusk" }))
    );

    // Back then skips the search that found nothing.
    await vi.waitFor(() =>
      expect(gotoSpy).toHaveBeenCalledExactlyOnceWith(
        `/some-base-path/accounts/?key=${account}&name=alice.dusk`,
        { replaceState: true }
      )
    );

    gotoSpy.mockRestore();
  });

  it("should keep a notice closed that is closed before the search page's address comes", async () => {
    const from = "http://localhost/some-base-path/accounts/?key=abc";
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    pageStore.at(from);

    const { container } = render(Navbar);

    // The search page's navigation starts, and is still on its way.
    await showSearchNotification(container);
    expect(gotoSpy).toHaveBeenCalledOnce();

    await fireEvent.click(
      /** @type {HTMLButtonElement} */ (
        container.querySelector(".search-notification__header-action")
      )
    );

    expect(getNotificationElement(container)).toBeNull();
    // Staying on the page, in its place, cancels the search page's.
    expect(gotoSpy).toHaveBeenLastCalledWith(from, {
      keepFocus: true,
      noScroll: true,
      replaceState: true,
      state: {},
    });

    await act(() =>
      afterNavigateCallback(/** @type {any} */ ({ to: { url: new URL(from) } }))
    );

    expect(getNotificationElement(container)).toBeNull();

    gotoSpy.mockRestore();
  });

  it("should close a search page's notice by going back to the page searched from, or home when there is none", async () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    /** @param {App.PageState} state */
    const closeOn = async (state) => {
      pageStore.at(searchPage("foo_bar"), state);

      const { container, unmount } = render(Navbar);

      await act(() =>
        afterNavigateCallback(
          /** @type {any} */ ({ to: { url: new URL(searchPage("foo_bar")) } })
        )
      );
      await fireEvent.click(
        /** @type {HTMLButtonElement} */ (
          container.querySelector(".search-notification__header-action")
        )
      );
      unmount();
    };

    // Opened from another page: back to it.
    await closeOn({ searchedInApp: true });

    expect(back).toHaveBeenCalledOnce();
    expect(gotoSpy).not.toHaveBeenCalled();

    // Opened first, as from a shared link: home, in its place.
    await closeOn({});

    expect(back).toHaveBeenCalledOnce();
    expect(gotoSpy).toHaveBeenCalledExactlyOnceWith("/some-base-path/", {
      replaceState: true,
    });

    back.mockRestore();
    gotoSpy.mockRestore();
  });

  it("should make room for the search notification again once it floats, as when a tablet is turned", async () => {
    /** @type {Array<{ callback: ResizeObserverCallback, targets: Element[] }>} */
    const observers = [];

    vi.stubGlobal(
      "ResizeObserver",
      class {
        /** @param {ResizeObserverCallback} callback */
        constructor(callback) {
          this.callback = callback;
          /** @type {Element[]} */
          this.targets = [];
          observers.push(this);
        }

        /** @param {Element} target */
        observe(target) {
          this.targets.push(target);
        }

        unobserve() {}

        disconnect() {
          this.targets = [];
        }
      }
    );

    const { container } = render(Navbar);
    const nav = /** @type {HTMLElement} */ (container.querySelector("nav"));

    // Narrow: the notification sits in the page's flow and needs no room.
    await showSearchNotification(container);
    await tick();

    const notification = /** @type {HTMLElement} */ (
      getNotificationElement(container)
    );

    expect(nav.style.marginBottom).toBe("0px");

    // Wide: it floats over the page, so the navbar makes room below it.
    const style = document.createElement("style");

    style.textContent =
      ".dusk-navbar__menu--search-notification { position: absolute; }";
    document.head.append(style);
    Object.defineProperty(notification, "clientHeight", { value: 120 });

    for (const observer of observers) {
      if (observer.targets.includes(notification)) {
        observer.callback([], /** @type {any} */ (observer));
      }
    }

    await tick();

    expect(nav.style.marginBottom).toBe("120px");

    style.remove();
    vi.unstubAllGlobals();
  });

  it("should keep the search at the top, out of the pages, with no menu to open for it", () => {
    const { container, getByRole } = render(Navbar);
    const pages = getByRole("navigation", { name: "Explorer pages" });

    expect(pages.querySelector("form")).toBeNull();
    expect(container.querySelector(".dusk-navbar__search form")).not.toBeNull();
    expect(container.querySelector("[aria-expanded]")).toBeNull();
  });

  it("should search the .dusk name the notification suggests", async () => {
    const account = hostProvisioners[0].key;
    const gotoSpy = vi.spyOn(appNavigation, "goto");

    vi.mocked(resolveDuskName).mockResolvedValueOnce(account);

    const { container, getByRole } = render(Navbar);
    const input = getByRole("textbox");

    await fireEvent.input(input, { target: { value: "alice" } });
    await fireEvent.submit(
      /** @type {HTMLFormElement} */ (input.closest("form"))
    );

    const suggestion = await vi.waitFor(() =>
      getByRole("button", { name: "Search alice.dusk" })
    );

    await fireEvent.click(suggestion);

    await vi.waitFor(() =>
      expect(gotoSpy).toHaveBeenCalledWith(
        `/some-base-path/accounts/?key=${account}&name=alice.dusk`
      )
    );
    expect(resolveDuskName).toHaveBeenCalledWith("alice.dusk");
    expect(getNotificationElement(container)).toBeNull();

    gotoSpy.mockRestore();
  });
});
