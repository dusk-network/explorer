<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";

  import { Banner } from "$lib/dusk/components";
  import { resolveBlockId } from "$lib/duskevm/resolveBlockId";

  let error = false;

  onMount(() => {
    let active = true;
    const id = $page.params.id ?? "";

    resolveBlockId(id)
      .then(async (blockHash) => {
        if (active) {
          await goto(resolve(`/blocks/block?id=${blockHash}`), {
            replaceState: true,
          });
        }
      })
      .catch(() => {
        if (active) {
          error = true;
        }
      });

    return () => {
      active = false;
    };
  });
</script>

<section class="block">
  {#if error}
    <Banner title="Block link unavailable" variant="error">
      <p>The linked Dusk block could not be found.</p>
    </Banner>
  {:else}
    <Banner title="Opening block" variant="info">
      <p>Resolving the block on Dusk.</p>
    </Banner>
  {/if}
</section>
