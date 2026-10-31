import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import * as mockData from "$lib/mock-data";
import { resolveAfter } from "$lib/dusk/promise";
import { appStore, chainHeadStore, chainStatsStore } from "$lib/stores";

import { StatisticsPanel } from "..";

const marketDataSettleTime = vi.hoisted(() => {
  vi.useFakeTimers();

  return 100;
});
// The map's countries are drawn in full on the home page's snapshot.
vi.mock("$lib/components", async (importOriginal) => {
  /** @type {import("$lib/components")} */
  const original = await importOriginal();
  const { default: WorldMapStub } =
    await import("./test-components/WorldMapStub.svelte");

  return { ...original, WorldMap: WorldMapStub };
});
vi.mock("$lib/services", async (importOriginal) => {
  /** @type {import("$lib/services")} */
  const original = await importOriginal();
  const { apiMarketData, nodeLocationsCount } = await import("$lib/mock-data");
  const { current_price: currentPrice, market_cap: marketCap } =
    apiMarketData.market_data;

  return {
    ...original,
    duskAPI: {
      ...original.duskAPI,
      getMarketData: () =>
        resolveAfter(marketDataSettleTime, { currentPrice, marketCap }),
      getNodeLocations: vi.fn().mockResolvedValue(nodeLocationsCount),
    },
  };
});
// The chain's newest block and the numbers, as the test gives them.
vi.mock("$lib/stores", async (importOriginal) => {
  /** @type {import("$lib/stores")} */
  const original = await importOriginal();
  const { writable } = await import("svelte/store");

  return {
    ...original,
    chainHeadStore: writable({ error: null, head: null }),
    chainStatsStore: writable({ data: null, error: null }),
  };
});

/** @type {import("svelte/store").Writable<{ error: Error | null, head: any }>} */
const head = /** @type {any} */ (chainHeadStore);

/** @type {import("svelte/store").Writable<{ data: Stats | null, error: Error | null }>} */
const stats = /** @type {any} */ (chainStatsStore);

/**
 * The chain's newest block, `ago` milliseconds since the page learned of it.
 *
 * @param {number} height
 * @param {number} [ago]
 */
const newestBlock = (height, ago = 0) => {
  const at = Date.now() - ago;

  head.set({
    error: null,
    head: {
      at,
      date: new Date(at),
      hash: `h${height}`,
      height,
      transactions: 0,
    },
  });
  stats.set({
    data: {
      ...mockData.apiStats,
      lastBlock: height,
      lastBlockDate: new Date(at),
    },
    error: null,
  });
};

/**
 * The titles of the leading cards, or of the smaller ones after them.
 *
 * @param {HTMLElement} container
 * @param {"primary" | "secondary"} which
 */
const titlesOf = (container, which) =>
  Array.from(
    container.querySelectorAll(
      `.statistics-panel__statistics-item--${which} .statistics-panel__statistics-item-title`
    ),
    (title) => {
      const label = /** @type {Element} */ (title.cloneNode(true));

      // The last block's label says whether new blocks come, after it.
      label.querySelector(".statistics-panel__live")?.remove();

      return label.textContent?.trim();
    }
  );

describe("StatisticsPanel", () => {
  afterEach(() => {
    cleanup();
    head.set({ error: null, head: null });
    stats.set({ data: null, error: null });
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/components");
    vi.doUnmock("$lib/services");
    vi.doUnmock("$lib/stores");
  });

  /** @param {number} chainId */
  const setChain = (chainId) =>
    appStore.setNodeInfo({
      ...get(appStore).nodeInfo,
      // eslint-disable-next-line camelcase
      chain_id: chainId,
    });

  it("should render the StatisticsPanel, with the numbers once they come", async () => {
    setChain(1);

    const { container } = render(StatisticsPanel);

    expect(container.firstElementChild).toMatchSnapshot();

    await act(() => newestBlock(mockData.apiStats.lastBlock));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    // snapshot with received data from APIs
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("should show no DUSK price or market cap on a test network", async () => {
    setChain(2);

    const { container, getByText, queryByText } = render(StatisticsPanel);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    expect(queryByText("DUSK price")).toBeNull();
    expect(queryByText("Market cap")).toBeNull();
    expect(getByText("Current stake")).toBeInTheDocument();
    expect(
      container.querySelectorAll(".statistics-panel__statistics-item")
    ).toHaveLength(8);
    // Four numbers lead as cards; the rest follow, smaller.
    expect(titlesOf(container, "primary")).toStrictEqual([
      "Current stake",
      "Last block",
      "Total transactions",
      "Active provisioners",
    ]);
    expect(titlesOf(container, "secondary")).toStrictEqual([
      "Pending stake",
      "Pending provisioners",
      "Largest node cluster",
      "Largest cluster location",
    ]);

    await act(() => setChain(1));

    expect(getByText("DUSK price")).toBeInTheDocument();
    expect(getByText("Market cap")).toBeInTheDocument();
    // On mainnet the price leads, and the market cap follows.
    expect(titlesOf(container, "primary")[0]).toBe("DUSK price");
    expect(titlesOf(container, "secondary")[0]).toBe("Market cap");
  });

  it("should lead with the network's map, and say where its places come from and how precise they are", async () => {
    const { container } = render(StatisticsPanel);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    const face = container.querySelector(".statistics-panel__face");

    expect(face?.tagName).toBe("FIGURE");
    expect(face?.querySelector(".nodes-world-map")).toHaveAttribute(
      "data-places",
      String(mockData.nodeLocationsCount.length)
    );
    // 88 nodes in 21 cities.
    expect(face?.querySelector("figcaption")).toHaveTextContent(
      "Approximate locations of 88 nodes the explorer's node knows of, from their public IP addresses, rounded to the city. The bigger the ring, the more nodes."
    );
    // First in the panel, before the numbers.
    expect(container.firstElementChild?.firstElementChild).toBe(face);
  });

  it("should say the chain is live while new blocks come, and that it waits for them when none has come for half a minute", async () => {
    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    await act(() => newestBlock(100));

    expect(status).toHaveTextContent(/^Live$/);
    expect(status).not.toHaveClass("statistics-panel__live--waiting");
    expect(
      status.closest(".statistics-panel__statistics-item-title")
    ).toHaveTextContent(/^Last block/);

    // No new block since.
    await vi.advanceTimersByTimeAsync(29_000);

    expect(status).toHaveTextContent(/^Live$/);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(status).toHaveTextContent(/^Waiting for blocks$/);
    expect(status).toHaveClass("statistics-panel__live--waiting");

    await act(() => newestBlock(101));

    expect(status).toHaveTextContent(/^Live$/);
    expect(status).not.toHaveClass("statistics-panel__live--waiting");
  });

  it("should make no claim about the chain before the first block comes", async () => {
    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    // A slow first answer isn't a stalled chain.
    await vi.advanceTimersByTimeAsync(31_000);

    expect(status).toHaveTextContent(/^$/);
    expect(status.querySelector(".statistics-panel__live-dot")).toBeNull();

    await act(() => newestBlock(100));

    expect(status).toHaveTextContent(/^Live$/);
  });

  it("should make no claim about the chain while its last block can't be read", async () => {
    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");
    const error = new Error("Unreachable");

    await act(() => {
      newestBlock(100);
      head.update(({ head: newest }) => ({ error, head: newest }));
      stats.set({ data: null, error });
    });

    expect(status).toHaveTextContent(/^$/);

    await vi.advanceTimersByTimeAsync(31_000);

    expect(status).toHaveTextContent(/^$/);
    expect(status).not.toHaveClass("statistics-panel__live--waiting");
  });

  it("should say the chain waits for blocks when its newest block came half a minute ago or more", async () => {
    const { getByRole } = render(StatisticsPanel);

    // As the page learned of a block on opening, from its own time.
    await act(() => newestBlock(100, 5 * 60_000));

    expect(getByRole("status")).toHaveTextContent(/^Waiting for blocks$/);
  });

  it("should mark a number rounded to show as about that much, with a sign that can't pass for a minus", async () => {
    setChain(1);

    const { container } = render(StatisticsPanel);

    await act(() => newestBlock(mockData.apiStats.lastBlock));
    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    const abouts = Array.from(
      container.querySelectorAll(".statistics-panel__statistics-item-about")
    );

    // The current stake, as a card, and the pending stake, in the row.
    expect(abouts).toHaveLength(2);

    for (const about of abouts) {
      expect(about.querySelector("[aria-hidden='true']")).toHaveTextContent(
        /^≈$/
      );
      expect(about.querySelector(".sr-only")).toHaveTextContent(/^about$/);
      expect(about.nextElementSibling).toHaveClass(
        "statistics-panel__statistics-item-value"
      );
    }

    expect(container.textContent).not.toContain("~");
    expect(container.querySelector(".approximate")).toBeNull();
  });
});
