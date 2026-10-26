<script>
  import { formatDusk, formatDuskExact } from "$lib/dusk/currency";
  import { makeClassName } from "$lib/dusk/string";

  /** @type {string | undefined} */
  export let className = undefined;

  /**
   * An amount in LUX, shown in DUSK to at most four decimals, in full on
   * hover.
   *
   * @type {number}
   */
  export let lux;

  $: [whole, decimals] = formatDusk(lux).split(".");
</script>

<p
  class={makeClassName(["dusk-amount", className])}
  data-tooltip-id="main-tooltip"
  data-tooltip-place="right"
  data-tooltip-type="info"
  data-tooltip-text="{formatDuskExact(lux)} DUSK"
>
  {whole}{#if decimals}.<span class="decimal-shadow">{decimals}</span>{/if} DUSK
</p>
