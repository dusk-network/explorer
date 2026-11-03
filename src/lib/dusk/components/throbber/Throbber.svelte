<svelte:options immutable={true} />

<script>
  import { makeClassName } from "$lib/dusk/string";

  import "./Throbber.css";

  /** @type {string | undefined} */
  export let className = undefined;

  /** The throbber's size in pixels. */
  export let size = 40;

  // The Dusk mark's arc, as the web wallet turns it.
  const path = [
    "M75.4 126.63",
    "a11.43 11.43 0 0 1-2.1-22.65 ",
    "40.9 40.9 0 0 0 30.5-30.6 ",
    "11.4 11.4 0 1 1 22.27 4.87",
    "h.02",
    "a63.77 63.77 0 0 1-47.8 48.05",
    "v-.02",
    "a11.38 11.38 0 0 1-2.93.37",
    "z",
  ].join("");
</script>

<!-- What it waits for is in words beside it: the arc itself says nothing. -->
<svg
  aria-hidden="true"
  class={makeClassName(["dusk-throbber", className])}
  height={size}
  viewBox="0 0 128 128"
  width={size}
>
  <path d={path} />
</svg>
