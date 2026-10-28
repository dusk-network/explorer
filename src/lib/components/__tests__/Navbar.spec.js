import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import * as appNavigation from "$app/navigation";

import { hostProvisioners } from "$lib/mock-data";
import { resolveDuskName } from "$lib/dusk-domains";

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

  it("should hide the mobile menu after a navigation event", async () => {
    const { container } = render(Navbar);

    const btnMenuToggle = /** @type {HTMLButtonElement} */ (
      container.querySelector(".dusk-navbar__toggle")
    );
    const menu = /** @type {HTMLDivElement} */ (
      container.querySelector(".dusk-navbar__menu")
    );

    expect(menu).toHaveClass("dusk-navbar__menu--hidden");
    expect(btnMenuToggle).toHaveAttribute("aria-expanded", "false");

    await fireEvent.click(btnMenuToggle);

    expect(menu).not.toHaveClass("dusk-navbar__menu--hidden");
    expect(btnMenuToggle).toHaveAttribute("aria-expanded", "true");

    await act(() => {
      // @ts-expect-error we don't care for navigation details
      afterNavigateCallback();
    });

    expect(menu).toHaveClass("dusk-navbar__menu--hidden");
    expect(btnMenuToggle).toHaveAttribute("aria-expanded", "false");
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

  it("should keep the search out of the menu, so phones show it without opening the menu", () => {
    const { container } = render(Navbar);
    const menu = /** @type {HTMLDivElement} */ (
      container.querySelector("#dusk-navbar-menu")
    );

    expect(menu).toHaveClass("dusk-navbar__menu--hidden");
    expect(menu.querySelector("form")).toBeNull();
    expect(container.querySelector(".dusk-navbar__search form")).not.toBeNull();
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
