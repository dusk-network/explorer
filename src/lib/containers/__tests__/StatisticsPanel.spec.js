import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/svelte";
import { get } from "svelte/store";

import * as mockData from "$lib/mock-data";
import { resolveAfter } from "$lib/dusk/promise";
import { duskAPI } from "$lib/services";
import { appStore } from "$lib/stores";

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
  const { apiMarketData, apiStats, nodeLocationsCount } =
    await import("$lib/mock-data");
  const { current_price: currentPrice, market_cap: marketCap } =
    apiMarketData.market_data;

  return {
    ...original,
    duskAPI: {
      ...original.duskAPI,
      getMarketData: () =>
        resolveAfter(marketDataSettleTime, { currentPrice, marketCap }),
      getNodeLocations: vi.fn().mockResolvedValue(nodeLocationsCount),
      getStats: vi.fn().mockResolvedValue(apiStats),
    },
  };
});

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

/**
 * Hides the page, or shows it again, as a browser does with a tab.
 *
 * @param {boolean} hidden
 */
const setHidden = (hidden) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

/** The page as jsdom has it: shown. */
const showPage = () => {
  // @ts-ignore The own property set above, over jsdom's own.
  delete document.hidden;
};

describe("StatisticsPanel", () => {
  const { statsFetchInterval } = get(appStore);

  afterEach(() => {
    cleanup();
    vi.mocked(duskAPI.getStats).mockResolvedValue(mockData.apiStats);
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.doUnmock("$lib/components");
    vi.doUnmock("$lib/services");
  });

  /** @param {number} chainId */
  const setChain = (chainId) =>
    appStore.setNodeInfo({
      ...get(appStore).nodeInfo,
      // eslint-disable-next-line camelcase
      chain_id: chainId,
    });

  it("should render the StatisticsPanel, query for the necessary info, start polling for stats and stop the polling when unmounted", async () => {
    setChain(1);

    const { container, unmount } = render(StatisticsPanel);

    expect(container.firstElementChild).toMatchSnapshot();
    expect(duskAPI.getStats).toHaveBeenCalledTimes(1);
    expect(duskAPI.getStats).toHaveBeenNthCalledWith(1);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    // snapshot with received data from APIs
    expect(container.firstElementChild).toMatchSnapshot();

    await vi.advanceTimersByTimeAsync(
      statsFetchInterval - marketDataSettleTime
    );

    expect(duskAPI.getStats).toHaveBeenCalledTimes(2);
    expect(duskAPI.getStats).toHaveBeenNthCalledWith(2);

    await vi.advanceTimersByTimeAsync(statsFetchInterval);

    expect(duskAPI.getStats).toHaveBeenCalledTimes(3);
    expect(duskAPI.getStats).toHaveBeenNthCalledWith(3);

    unmount();

    await vi.advanceTimersByTimeAsync(statsFetchInterval * 10);

    expect(duskAPI.getStats).toHaveBeenCalledTimes(3);
  });
  it("should show no DUSK price or market cap on a test network", async () => {
    vi.mocked(duskAPI.getStats).mockClear();
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

  it("should lead with the network's map, and say what its rings are", async () => {
    const { container } = render(StatisticsPanel);

    await vi.advanceTimersByTimeAsync(marketDataSettleTime);

    const face = container.querySelector(".statistics-panel__face");

    expect(face?.tagName).toBe("FIGURE");
    expect(face?.querySelector(".nodes-world-map")).toHaveAttribute(
      "data-places",
      String(mockData.nodeLocationsCount.length)
    );
    expect(face?.querySelector("figcaption")).toHaveTextContent(
      "Rings show where provisioners run nodes. The bigger the ring, the more nodes."
    );
    // First in the panel, before the numbers.
    expect(container.firstElementChild?.firstElementChild).toBe(face);
  });

  it("should say the chain is live while new blocks come, and that it waits for them when none has come for half a minute", async () => {
    let lastBlock = mockData.apiStats.lastBlock;

    vi.mocked(duskAPI.getStats).mockImplementation(async () => ({
      ...mockData.apiStats,
      lastBlock,
    }));

    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    await vi.advanceTimersByTimeAsync(0);

    expect(status).toHaveTextContent(/^Live$/);
    expect(status).not.toHaveClass("statistics-panel__live--waiting");
    expect(
      status.closest(".statistics-panel__statistics-item-title")
    ).toHaveTextContent(/^Last block/);

    // The same block, poll after poll.
    await vi.advanceTimersByTimeAsync(29_000);

    expect(status).toHaveTextContent(/^Live$/);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(status).toHaveTextContent(/^Waiting for blocks$/);
    expect(status).toHaveClass("statistics-panel__live--waiting");

    lastBlock += 1;
    await vi.advanceTimersByTimeAsync(statsFetchInterval);

    expect(status).toHaveTextContent(/^Live$/);
    expect(status).not.toHaveClass("statistics-panel__live--waiting");
  });

  it("should make no claim about the chain before the first answer comes", async () => {
    /** @type {(stats: Stats) => void} */
    let answer = () => {};

    vi.mocked(duskAPI.getStats).mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );

    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    // A slow first answer isn't a stalled chain.
    await vi.advanceTimersByTimeAsync(31_000);

    expect(status).toHaveTextContent(/^$/);
    expect(status.querySelector(".statistics-panel__live-dot")).toBeNull();

    answer(mockData.apiStats);
    await vi.advanceTimersByTimeAsync(0);

    expect(status).toHaveTextContent(/^Live$/);
  });

  it("should make no claim about the chain while its last block can't be read", async () => {
    vi.mocked(duskAPI.getStats).mockRejectedValue(new Error("Unreachable"));

    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    await vi.advanceTimersByTimeAsync(0);

    expect(status).toHaveTextContent(/^$/);

    await vi.advanceTimersByTimeAsync(31_000);

    expect(status).toHaveTextContent(/^$/);
    expect(status).not.toHaveClass("statistics-panel__live--waiting");
  });

  it("should date a block read after a gap by its own time, not by the read", async () => {
    let stats = {
      ...mockData.apiStats,
      lastBlock: 100,
      lastBlockDate: new Date(Date.now()),
    };

    vi.mocked(duskAPI.getStats).mockImplementation(async () => stats);

    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    await vi.advanceTimersByTimeAsync(0);

    expect(status).toHaveTextContent(/^Live$/);

    // The tab is hidden for five minutes, and the chain stops at a newer
    // block meanwhile.
    try {
      setHidden(true);
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      stats = {
        ...mockData.apiStats,
        lastBlock: 130,
        lastBlockDate: new Date(Date.now() - 4 * 60_000),
      };
      setHidden(false);
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      showPage();
    }

    expect(status).toHaveTextContent(/^Waiting for blocks$/);
  });

  it("should call a chain live as it moves, on a viewer's clock two minutes fast", async () => {
    const fast = 2 * 60_000;
    let lastBlock = 100;

    // Each block made just now, by the chain's time: two minutes ago by
    // the viewer's clock.
    vi.mocked(duskAPI.getStats).mockImplementation(async () => ({
      ...mockData.apiStats,
      lastBlock,
      lastBlockDate: new Date(Date.now() - fast),
    }));

    const { getByRole } = render(StatisticsPanel);
    const status = getByRole("status");

    // On opening, the page has only the block's own time to go by.
    await vi.advanceTimersByTimeAsync(0);

    expect(status).toHaveTextContent(/^Waiting for blocks$/);

    // The next block comes on a regular poll: the chain moved as the page
    // watched.
    lastBlock += 1;
    await vi.advanceTimersByTimeAsync(statsFetchInterval);

    expect(status).toHaveTextContent(/^Live$/);

    // Then no block for half a minute.
    await vi.advanceTimersByTimeAsync(31_000);

    expect(status).toHaveTextContent(/^Waiting for blocks$/);
  });

  it("should not call a chain live that had stopped before the page opened", async () => {
    vi.mocked(duskAPI.getStats).mockResolvedValue({
      ...mockData.apiStats,
      lastBlockDate: new Date(Date.now() - 5 * 60_000),
    });

    const { getByRole } = render(StatisticsPanel);

    await vi.advanceTimersByTimeAsync(0);

    expect(getByRole("status")).toHaveTextContent(/^Waiting for blocks$/);
  });

  it("should mark a number rounded to show as about that much, with a sign that can't pass for a minus", async () => {
    setChain(1);

    const { container } = render(StatisticsPanel);

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
