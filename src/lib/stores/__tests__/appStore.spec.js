import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { apiNodeInfo } from "$lib/mock-data";

describe("appStore", () => {
  const originalTouchStart = window.ontouchstart;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  delete window.ontouchstart;

  Object.defineProperty(navigator, "maxTouchPoints", {
    value: 0,
    writable: true,
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(() => {
    window.ontouchstart = originalTouchStart;

    Object.defineProperty(navigator, "maxTouchPoints", {
      value: originalMaxTouchPoints,
      writable: false,
    });
  });

  it("should be a readable store holding the information needed throughout the whole application", async () => {
    const { appStore } = await import("..");
    const { env } = import.meta;

    expect(appStore).toHaveProperty("subscribe", expect.any(Function));
    expect(appStore).not.toHaveProperty("set");
    expect(get(appStore)).toStrictEqual({
      blocksListEntries: Number(env.VITE_BLOCKS_LIST_ENTRIES),
      chainInfoEntries: Number(env.VITE_CHAIN_INFO_ENTRIES),
      darkMode: false,
      fetchInterval: Number(env.VITE_REFETCH_INTERVAL),
      hasTouchSupport: false,
      isSmallScreen: false,
      marketDataFetchInterval: Number(env.VITE_MARKET_DATA_REFETCH_INTERVAL),
      nodeInfo: {
        bootstrapping_nodes: [],
        chain_id: undefined,
        kadcast_address: "",
        version: "",
        version_build: "",
      },
      provisionersFetchInterval: Number(env.VITE_PROVISIONERS_REFETCH_INTERVAL),
      transactionsListEntries: Number(env.VITE_TRANSACTIONS_LIST_ENTRIES),
    });
  });

  it("should use default values for the fetch intervals if the env vars are missing", async () => {
    vi.stubEnv("VITE_REFETCH_INTERVAL", "");
    vi.stubEnv("VITE_MARKET_DATA_REFETCH_INTERVAL", "");
    vi.stubEnv("VITE_PROVISIONERS_REFETCH_INTERVAL", "");

    const { appStore } = await import("..");
    const {
      fetchInterval,
      marketDataFetchInterval,
      provisionersFetchInterval,
    } = get(appStore);

    expect(fetchInterval).toBe(10000);
    expect(marketDataFetchInterval).toBe(120000);
    expect(provisionersFetchInterval).toBe(30000);

    vi.unstubAllEnvs();
  });

  it("should use default values for list entry counts if the env vars are missing", async () => {
    vi.stubEnv("VITE_BLOCKS_LIST_ENTRIES", "");
    vi.stubEnv("VITE_CHAIN_INFO_ENTRIES", "");
    vi.stubEnv("VITE_TRANSACTIONS_LIST_ENTRIES", "");

    const { appStore } = await import("..");
    const { blocksListEntries, chainInfoEntries, transactionsListEntries } =
      get(appStore);

    expect(blocksListEntries).toBe(100);
    expect(chainInfoEntries).toBe(15);
    expect(transactionsListEntries).toBe(25);

    vi.unstubAllEnvs();
  });

  it("should expose a service method to set the node info", async () => {
    const { appStore } = await import("..");

    const initialNodeInfo = {
      bootstrapping_nodes: [],
      chain_id: undefined,
      kadcast_address: "",
      version: "",
      version_build: "",
    };

    expect(get(appStore).nodeInfo).toStrictEqual(initialNodeInfo);

    appStore.setNodeInfo(apiNodeInfo);
    expect(get(appStore).nodeInfo).toStrictEqual(apiNodeInfo);
  });
});
