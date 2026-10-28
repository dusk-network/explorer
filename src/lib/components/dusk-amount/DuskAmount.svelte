<script>
  import { luxToDusk } from "$lib/dusk/currency";
  import { makeClassName } from "$lib/dusk/string";
  import { createValueFormatter } from "$lib/dusk/value";

  /** @type {string | undefined} */
  export let className = undefined;

  /**
   * An amount in LUX, shown in DUSK to two decimals, in full on hover.
   *
   * @type {number}
   */
  export let lux;

  const formatter = createValueFormatter("en");
  const fixedNumberFormatter = createValueFormatter("en", 2, 2);

  $: dusk = luxToDusk(lux);
  $: [whole, decimals] = fixedNumberFormatter(dusk).split(".");
</script>

<p
  class={makeClassName(["dusk-amount", className])}
  data-tooltip-id="main-tooltip"
  data-tooltip-place="right"
  data-tooltip-type="info"
  data-tooltip-text="{formatter(dusk)} DUSK"
>
  {whole}.<span class="decimal-shadow">{decimals}</span> DUSK
</p>
