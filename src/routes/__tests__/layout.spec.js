import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, cleanup, fireEvent } from "@testing-library/svelte";
import { get } from "svelte/store";
import { duskAPI } from "$lib/services";
import { appStore as realAppStore } from "$lib/stores";
import { apiNodeInfo } from "$lib/mock-data";
import { renderWithSimpleContent } from "$lib/dusk/test-helpers";

import MainLayout from "../+layout.svelte";

function createTooltippedElement() {
  const tooltippedElement = document.body.appendChild(
    document.createElement("div")
  );

  tooltippedElement.setAttribute("data-tooltip-id", "main-tooltip");
  tooltippedElement.setAttribute("data-tooltip-text", "some text");

  return tooltippedElement;
}

vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {typeof import("$lib/stores")} */
  const original = await importOriginal();
  const storeGet = (await import("svelte/store")).get;
  const { mockReadableStore } = await import("$lib/dusk/test-helpers");
  const mockedAppStore = mockReadableStore(storeGet(original.appStore));

  return {
    ...original,
    appStore: {
      ...mockedAppStore,
      /** @param {NodeInfo} v w*/
      setNodeInfo: (v) =>
        mockedAppStore.setMockedStoreValue({
          ...mockedAppStore.getMockedStoreValue(),
          nodeInfo: v,
        }),
      /** @param {boolean} v */
      setTheme: (v) =>
        mockedAppStore.setMockedStoreValue({
          ...mockedAppStore.getMockedStoreValue(),
          darkMode: v,
        }),
    },
  };
});

// just an alias to force the type
const appStore =
  /** @type { AppStore & ReturnType<import("$lib/dusk/test-helpers").mockReadableStore>} */ (
    realAppStore
  );

describe("Main layout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 1));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const getNodeInfoSpy = vi
    .spyOn(duskAPI, "getNodeInfo")
    .mockResolvedValue(apiNodeInfo);

  const baseOptions = { props: {}, target: document.body };

  afterEach(() => {
    cleanup();
    getNodeInfoSpy.mockClear();
  });

  afterAll(() => {
    getNodeInfoSpy.mockRestore();
  });

  it("should render the app's main layout", () => {
    const { container } = renderWithSimpleContent(MainLayout, baseOptions);
    expect(container).toMatchSnapshot();
  });

  it("should change the overflow of document's body when the navbar toggle menu button is clicked", async () => {
    const { container } = renderWithSimpleContent(MainLayout, baseOptions);
    const navbarToggleButton = /** @type {HTMLButtonElement} */ (
      container.querySelector(".dusk-navbar__toggle")
    );

    await fireEvent.click(navbarToggleButton);

    expect(document.body.style.overflow).toBe("hidden");

    await fireEvent.click(navbarToggleButton);

    expect(document.body.style.overflow).toBe("auto");
  });

  it('should add and remove the "dark" class name to the `html` element when the `darkMode` value changes in the settings store', async () => {
    const isDarkMode = () => get(appStore).darkMode;
    const hasDarkClass = () =>
      document.documentElement.classList.contains("dark");

    expect(isDarkMode()).toBe(false);
    expect(hasDarkClass()).toBe(false);

    appStore.setTheme(true);

    expect(isDarkMode()).toBe(true);
    expect(hasDarkClass()).toBe(true);

    appStore.setTheme(false);

    expect(isDarkMode()).toBe(false);
    expect(hasDarkClass()).toBe(false);
  });

  it("should not set a delay show on the tooltip if the device has touch support", async () => {
    vi.useFakeTimers();

    renderWithSimpleContent(MainLayout, baseOptions);

    const tooltip = document.getElementById("main-tooltip");
    const tooltippedElement = createTooltippedElement();

    expect(get(appStore).hasTouchSupport).toBe(true);
    expect(tooltip).toHaveAttribute("aria-hidden", "true");

    await fireEvent.mouseEnter(tooltippedElement);
    await vi.advanceTimersByTimeAsync(1);

    expect(tooltip).toHaveAttribute("aria-hidden", "false");

    vi.useRealTimers();
  });

  it("should use the default delay for the tooltip if the device has touch support", async () => {
    const defaultDelayShow = 500;

    vi.useFakeTimers();

    appStore.setMockedStoreValue({
      ...get(appStore),
      hasTouchSupport: false,
    });

    renderWithSimpleContent(MainLayout, baseOptions);

    const tooltippedElement = createTooltippedElement();
    const tooltip = document.getElementById("main-tooltip");

    expect(tooltip).toHaveAttribute("aria-hidden", "true");

    await fireEvent.mouseEnter(tooltippedElement);
    await vi.advanceTimersByTimeAsync(defaultDelayShow - 1);

    expect(tooltip).toHaveAttribute("aria-hidden", "true");

    await vi.advanceTimersByTimeAsync(1);

    expect(tooltip).toHaveAttribute("aria-hidden", "false");

    vi.useRealTimers();
  });

  it("should set the node information when the layout is mounted", async () => {
    vi.useFakeTimers();

    const nodeInfoInitialState = {
      /* eslint-disable camelcase */
      bootstrapping_nodes: [],
      chain_id: undefined,
      kadcast_address: "",
      version: "",
      version_build: "",
      /* eslint-enable camelcase */
    };

    appStore.setNodeInfo(nodeInfoInitialState);

    expect(get(appStore).nodeInfo).toStrictEqual(nodeInfoInitialState);

    renderWithSimpleContent(MainLayout, baseOptions);

    expect(getNodeInfoSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(get(appStore).nodeInfo).toStrictEqual(apiNodeInfo);

    appStore.setNodeInfo(nodeInfoInitialState);

    expect(get(appStore).nodeInfo).toStrictEqual(nodeInfoInitialState);

    vi.useRealTimers();
  });

  it("should say at the top of a test network that test DUSK has no value", async () => {
    const { getByRole, queryByRole } = renderWithSimpleContent(
      MainLayout,
      baseOptions
    );

    await vi.advanceTimersByTimeAsync(1);

    const strip = /** @type {HTMLElement} */ (getByRole("note"));

    expect(strip).toHaveTextContent("Testnet · Test DUSK has no value");
    expect(strip.nextElementSibling).toHaveClass("dusk-navbar");

    // eslint-disable-next-line camelcase
    await act(() => appStore.setNodeInfo({ ...apiNodeInfo, chain_id: 1 }));

    expect(queryByRole("note")).toBeNull();
  });

  it("should show a search that found nothing in place of the page, until it is closed", async () => {
    const { container, getByRole } = renderWithSimpleContent(
      MainLayout,
      baseOptions
    );
    const main = /** @type {HTMLElement} */ (container.querySelector("main"));
    const input = /** @type {HTMLInputElement} */ (
      container.querySelector("input")
    );

    expect(main).toBeVisible();

    await fireEvent.input(input, { target: { value: "bad_name" } });
    await fireEvent.submit(
      /** @type {HTMLFormElement} */ (input.closest("form"))
    );

    expect(container.querySelector(".search-notification")).toHaveTextContent(
      "Nothing found for bad_name"
    );
    expect(main).not.toBeVisible();

    await fireEvent.click(
      /** @type {HTMLElement} */ (getByRole("button", { name: "Close" }))
    );

    expect(main).toBeVisible();
  });
});
