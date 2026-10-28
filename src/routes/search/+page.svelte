<script>
  import { page } from "$app/stores";

  $: query = $page.url.searchParams.get("q")?.trim();
</script>

<!--
  A search that found nothing: its own address, so that a reload or a shared
  link searches again. The notice under the search box says why; this page
  stands under it.
-->
<p class="search-page">
  {query
    ? "Searching…"
    : "Search by account address, block height or hash, transaction ID or .dusk name."}
</p>

<style lang="postcss">
  .search-page {
    margin: 0;
    color: var(--calm-muted);
  }
</style>
