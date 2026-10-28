<svelte:options immutable={true} />

<script>
  import "./FullValue.css";

  /**
   * An address, an ID or a hash, in full.
   *
   * @type {string}
   */
  export let value;

  /** How many characters at each end to set apart, to compare at a glance. */
  export let ends = 6;

  $: [head, middle, tail] =
    value.length > ends * 2
      ? [value.slice(0, ends), value.slice(ends, -ends), value.slice(-ends)]
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
