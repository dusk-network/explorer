import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";
import { readFileSync } from "node:fs";
import { addCountAndUnique } from "$lib/chain-info";
import { WorldMap } from "..";
import { apiNodeLocations } from "$lib/mock-data";

describe("World Map", () => {
  afterEach(cleanup);

  it("renders the WorldMap component with nodes", () => {
    const props = {
      nodes: addCountAndUnique(apiNodeLocations),
    };
    const { container } = render(WorldMap, props);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("renders the WorldMap component even if nodes is empty array", () => {
    const props = {
      nodes: [],
    };
    const { container } = render(WorldMap, props);

    expect(container.firstElementChild).toMatchSnapshot();
  });

  /**
   * The land was drawn with d3-geo, which placed the nodes too. Where d3
   * put each of these places, and how big a ring it gave each count, to six
   * decimals: from d3-geo 3.1.1's `geoNaturalEarth1().scale(195)
   * .center([0, 8])` and d3-scale 4.0.2's `scaleSqrt().domain([0, 100])
   * .range([0, 20])`, never under 5.
   *
   * @type {[string, number, number, number, number, number, number][]}
   */
  const placedByD3 = [
    // [place, longitude, latitude, nodes, x, y, ring]
    ["Amsterdam", 4.9392, 52.352, 15, 492.641052, 98.265519, 7.745967],
    ["North Bergen", -74.0247, 40.793, 25, 278.360587, 137.099536, 10],
    ["Hillsboro", -122.9638, 45.5397, 1, 152.686309, 120.962847, 5],
    ["Singapore", 103.695, 1.32123, 100, 787.258093, 272.902685, 20],
    ["Sydney", 151.1415, -33.808, 150, 903.394649, 393.75887, 24.494897],
    ["North Pole", 0, 90, 2, 480, 0.065729, 5],
    ["South Pole", 0, -90, 7, 480, 554.798027, 5.291503],
    ["Antimeridian, east", 180, 0, 3, 1013.400021, 277.431878, 5],
    ["Antimeridian, west", -180, 0, 40, -53.400021, 277.431878, 12.649111],
    ["0°, 0°", 0, 0, 1, 480, 277.431878, 5],
  ];

  it("should place each node and size its ring where d3 did, to well under a pixel", () => {
    const { container } = render(WorldMap, {
      nodes: placedByD3.map(([city, lon, lat, count]) => ({
        city,
        count,
        country: "Somewhere",
        countryCode: "SW",
        lat,
        lon,
      })),
    });
    const markers = container.querySelectorAll(".nodes-world-map__location");

    expect(markers).toHaveLength(placedByD3.length);

    placedByD3.forEach(([city, , , count, x, y, ring], index) => {
      const marker = markers[index];
      const [, left, top] =
        /^translate\((.+), (.+)\)$/.exec(
          marker.getAttribute("transform") ?? ""
        ) ?? [];
      const drawn = marker.querySelector(".nodes-world-map__location-ring");

      expect(marker).toHaveAttribute(
        "data-tooltip-text",
        `Somewhere - ${city} - ${count} ${count === 1 ? "node" : "nodes"}`
      );
      expect(Number(left)).toBeCloseTo(x, 5);
      expect(Number(top)).toBeCloseTo(y, 5);
      expect(Number(drawn?.getAttribute("r"))).toBeCloseTo(ring, 5);
    });
  });

  /*
   * The rings breathe, from the chain's blue to a lighter one and back,
   * unless the viewer asks for reduced motion. The map's own styles, which
   * tests don't load by themselves, decide it; jsdom has no motion setting,
   * so the media query is set by hand.
   */
  describe("rings", () => {
    // A path in a variable: Vite makes a literal one an asset's URL.
    const sheet = "../world-map/WorldMap.css";

    /** @type {HTMLStyleElement} */
    let style;

    /** @param {"full" | "reduced"} motion */
    const ringsWith = (motion) => {
      style = document.createElement("style");
      style.textContent = readFileSync(
        new URL(sheet, import.meta.url),
        "utf8"
      ).replaceAll(
        "@media (prefers-reduced-motion: reduce)",
        motion === "reduced" ? "@media all" : "@media not all"
      );
      document.head.append(style);

      const { container } = render(WorldMap, {
        nodes: addCountAndUnique(apiNodeLocations),
      });

      return Array.from(
        container.querySelectorAll(".nodes-world-map__location"),
        (ring) => getComputedStyle(ring)
      );
    };

    afterEach(() => style.remove());

    it("should pulse every ring slowly, in sync, to a lighter blue and back", () => {
      const rings = ringsWith("full");

      expect(rings.length).toBeGreaterThan(1);

      for (const ring of rings) {
        expect([
          ring.animationName,
          ring.animationDuration,
          ring.animationTimingFunction,
          ring.animationIterationCount,
          ring.animationDelay,
        ]).toStrictEqual([
          "nodes-world-map-pulse",
          "3s",
          "ease-in-out",
          "infinite",
          // No delay of its own: every ring in step.
          "0s",
        ]);
      }

      expect(style.textContent).toMatch(
        /@keyframes nodes-world-map-pulse \{\s*50% \{\s*color: var\(--chain-blue-glow\);\s*\}\s*\}/
      );
    });

    it("should keep the rings still, in the chain's blue, for a viewer who reduces motion", () => {
      for (const ring of ringsWith("reduced")) {
        expect(ring.animationName).toBe("none");
        expect(ring.color).toBe("var(--chain-blue)");
      }
    });
  });
});
