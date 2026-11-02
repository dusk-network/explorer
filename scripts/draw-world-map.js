/*
 * Draws the world map's land, from the countries in `world-map.json`, into
 * `land.js`: one path the page shows as it is, in place of the outlines and
 * the code to project them. Run it again only when the countries or the
 * projection change.
 *
 * It projects with d3-geo, which the app doesn't install:
 *
 *   npm install --no-save d3-geo@3.1.1 && node scripts/draw-world-map.js
 *
 * The projection must stay the one `WorldMap.svelte` places the nodes with.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { geoNaturalEarth1, geoPath } from "d3-geo";

const folder = new URL("../src/lib/components/world-map/", import.meta.url);
const countries = JSON.parse(
  readFileSync(new URL("world-map.json", folder), "utf8")
);
const projection = geoNaturalEarth1().scale(195).center([0, 8]);

// d3 draws every outline as "M x,y L x,y … Z", to a tenth of a unit.
const drawn = geoPath(projection).digits(1)(countries);

if (!drawn || !/^(M[^MLZ]+(L[^MLZ]+)+Z)+$/.test(drawn)) {
  throw new Error("Expected only closed outlines from d3");
}

/** @param {string} point */
const tenths = (point) =>
  point.split(",").map((value) => Math.round(Number(value) * 10));

/** @param {number} value */
const units = (value) => String(value / 10);

// Each point after an outline's first as the step from the one before: the
// same points, a third smaller once compressed.
const land = drawn
  .slice(1, -1)
  .split("ZM")
  .map((outline) => {
    const points = outline.split("L").map(tenths);
    const [[startX, startY]] = points;
    const steps = points
      .slice(1)
      .map(
        ([x, y], index) =>
          `${units(x - points[index][0])},${units(y - points[index][1])}`
      );

    return `M${units(startX)},${units(startY)}l${steps.join(" ")}z`;
  })
  .join("");

writeFileSync(
  new URL("land.js", folder),
  `// Drawn by scripts/draw-world-map.js from world-map.json.\nexport default ${JSON.stringify(land)};\n`
);
