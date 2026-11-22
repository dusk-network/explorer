import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { WorldMap } from "..";

describe("WorldMap", () => {
  afterEach(cleanup);

  it("should draw every place, also two that IP lookups put at one point", () => {
    // Two cities, and a country, that a lookup gives the same coordinates.
    const point = { lat: 49.4527, lon: 11.0783 };
    const nodes = [
      {
        ...point,
        city: "Nuremberg",
        count: 3,
        country: "Germany",
        countryCode: "DE",
      },
      {
        ...point,
        city: "Fürth",
        count: 2,
        country: "Germany",
        countryCode: "DE",
      },
      {
        ...point,
        city: "Nuremberg",
        count: 1,
        country: "Elsewhere",
        countryCode: "XX",
      },
      {
        city: "Amsterdam",
        count: 1,
        country: "The Netherlands",
        countryCode: "NL",
        lat: 52.352,
        lon: 4.9392,
      },
    ];

    const { container } = render(WorldMap, { props: { nodes } });
    const places = Array.from(
      container.querySelectorAll("[data-tooltip-text]"),
      (place) => place.getAttribute("data-tooltip-text"),
    );

    expect(places).toHaveLength(4);
    expect(places).toStrictEqual(
      nodes.map(({ city, count, country }) =>
        expect.stringMatching(
          new RegExp(`^${country}\\b.*\\b${city}\\b.*\\b${count} nodes?$`),
        ),
      ),
    );
  });
});
