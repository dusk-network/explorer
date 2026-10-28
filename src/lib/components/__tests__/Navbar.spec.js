import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import * as appNavigation from "$app/navigation";

import { apiNodeInfo, hostProvisioners } from "$lib/mock-data";
import { resolveDuskName } from "$lib/dusk-domains";
import { appStore } from "$lib/stores";

import { Navbar } from "..";

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  resolveDuskName: vi.fn(),
}));

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
  });

  afterAll(() => {
    afterNavigateSpy.mockRestore();
  });

  it("renders the Navbar component", () => {
    const { container } = render(Navbar);

    expect(container.firstElementChild).toMatchSnapshot();
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
      // @ts-expect-error we don't care for navigation details
      afterNavigateCallback();
    });

    expect(getNotificationElement(container)).toBeNull();
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
