<svelte:options immutable={true} />

<script>
  import "./FullValue.css";

  /**
   * An address, an ID or a hash, in full.
   *
   * @type {string}
   */
  export let value;

  /**
   * Whether it is an EVM address or hash, whose short form every Dusk app
   * gives as 0x and four characters, and the last four.
   *
   * @type {boolean}
   */
  export let evm = false;

  // The ends set apart, to compare at a glance: those its short form keeps.
  $: [first, last] = evm ? [6, 4] : [6, 6];
  $: [head, middle, tail] =
    value.length > first + last
      ? [value.slice(0, first), value.slice(first, -last), value.slice(-last)]
      : ["", value, ""];
</script>

<!--
  As the web wallet shows them: the first and last characters in the text's
  colour, the middle muted and free to wrap, and the end never split.
-->
<span class="full-value"
  ><b class="full-value__end">{head}</b><span class="full-value__middle"
    >{middle}</span
  ><b class="full-value__end full-value__tail">{tail}</b></span
>
