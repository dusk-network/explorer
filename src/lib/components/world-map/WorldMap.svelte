<script>
  import land from "./land.js";

  import "./WorldMap.css";

  /** @type {NodeLocation[] | null}*/
  export let nodes;

  /*
   * Where each node goes: Natural Earth 1 at scale 195, centred on 0°, 8°N,
   * the projection the land was drawn with (scripts/draw-world-map.js).
   * Computed term for term as d3-geo computes it, so each ring sits exactly
   * where d3 put it.
   */
  const radians = Math.PI / 180;

  /** @type {(lambda: number, phi: number) => [number, number]} */
  const naturalEarth1 = (lambda, phi) => {
    const phi2 = phi * phi;
    const phi4 = phi2 * phi2;

    return [
      lambda *
        (0.8707 -
          0.131979 * phi2 +
          phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4))),
      phi *
        (1.007226 +
          phi2 *
            (0.015085 +
              phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4))),
    ];
  };

  // 0°, 8°N at the centre, (480, 250).
  const offsetY = 250 + 195 * naturalEarth1(0, 8 * radians)[1];

  /** @param {NodeLocation} location */
  const placeOf = ({ lat, lon }) => {
    const [x, y] = naturalEarth1(lon * radians, lat * radians);

    return `translate(${480 + 195 * x}, ${offsetY - 195 * y})`;
  };

  /**
   * The ring's area grows with the count, as d3-scale's
   * `scaleSqrt().domain([0, 100]).range([0, 20])` has it.
   *
   * @param {number} count
   */
  const markerRadius = (count) => Math.max(5, 20 * (Math.sqrt(count) / 10));

  /** @param {number} count */
  const markerCoreRadius = (count) => Math.max(2.5, markerRadius(count) * 0.45);
</script>

<!--
  The network's face, at the head of the home page: the land in full
  contrast, from 75°N to 47°S, where the land and the nodes are; each place
  where provisioners run nodes as a ring, the bigger the more nodes. Its
  caption says so in words.
-->
<svg aria-hidden="true" class="nodes-world-map" viewBox="0 30 954 410">
  <defs>
    <pattern
      id="vertical-lines"
      patternUnits="userSpaceOnUse"
      width="7"
      height="10"
    >
      <line
        x1="3.5"
        y1="0"
        x2="3.5"
        y2="10"
        stroke="currentColor"
        stroke-width="1.4"
      />
    </pattern>
  </defs>
  <path d={land} style="fill:url(#vertical-lines)" />
  <g>
    {#each nodes ? nodes : [] as marker (`${marker.lon}x${marker.lat}`)}
      <g
        class="nodes-world-map__location"
        data-tooltip-id="main-tooltip"
        data-tooltip-text={`${marker.country} - ${marker.city} - ${marker.count} ${marker.count === 1 ? "node" : "nodes"}`}
        data-tooltip-place="top"
        data-tooltip-type="info"
        transform={placeOf(marker)}
      >
        <circle
          class="nodes-world-map__location-ring"
          r={markerRadius(marker.count)}
        ></circle>
        <circle
          class="nodes-world-map__location-core"
          r={markerCoreRadius(marker.count)}
        ></circle>
      </g>
    {/each}
  </g>
</svg>
