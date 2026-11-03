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
import { nodeAnswers } from "$lib/network";
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

  it('should add and remove the "dark" class name to the `html` element when the `darkMode` value changes in the settings store', async () => {
    renderWithSimpleContent(MainLayout, baseOptions);

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
      bootstrapping_nodes: [],
      chain_id: undefined,
      kadcast_address: "",
      version: "",
      version_build: "",
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

  it("should keep asking the node while the tab shows, and say so when it stops answering", async () => {
    const answers = () => get(nodeAnswers);

    renderWithSimpleContent(MainLayout, baseOptions);
    await vi.advanceTimersByTimeAsync(0);

    expect(getNodeInfoSpy).toHaveBeenCalledTimes(1);
    expect(answers()).toBe(true);

    // The node goes away.
    getNodeInfoSpy.mockRejectedValueOnce(new Error("offline"));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getNodeInfoSpy).toHaveBeenCalledTimes(2);
    expect(answers()).toBe(false);
    // What it said it was stays: the network's name, and the labels from it.
    expect(get(appStore).nodeInfo).toStrictEqual(apiNodeInfo);

    // It's back.
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getNodeInfoSpy).toHaveBeenCalledTimes(3);
    expect(answers()).toBe(true);

    // Nothing is asked while the tab is hidden, and once as it shows again.
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);

    await vi.advanceTimersByTimeAsync(180_000);

    expect(getNodeInfoSpy).toHaveBeenCalledTimes(3);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect(getNodeInfoSpy).toHaveBeenCalledTimes(4);
    hidden.mockRestore();
  });

  it("should leave the store alone when the node says the same", async () => {
    const setNodeInfo = vi.spyOn(appStore, "setNodeInfo");

    renderWithSimpleContent(MainLayout, baseOptions);
    await vi.advanceTimersByTimeAsync(0);
    setNodeInfo.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(getNodeInfoSpy).toHaveBeenCalled();
    expect(setNodeInfo).not.toHaveBeenCalled();
    setNodeInfo.mockRestore();
  });

  it("should tidy the mark from a link that came from the old address", () => {
    window.history.replaceState(null, "", "/blocks/block/?moved=1&id=abc");

    renderWithSimpleContent(MainLayout, baseOptions);

    expect(window.location.search).toBe("?id=abc");

    window.history.replaceState(null, "", "/?moved=1&");
    cleanup();
    renderWithSimpleContent(MainLayout, baseOptions);

    expect(window.location.search).toBe("");
    window.history.replaceState(null, "", "/");
  });
});
