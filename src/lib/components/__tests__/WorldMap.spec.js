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
