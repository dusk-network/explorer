<script>
  /** @type {NodeLocation[] | null} */
  export let nodes;
</script>

<!-- The map, in short: how many places it rings. -->
<svg class="nodes-world-map" data-places={nodes?.length ?? 0}></svg>
