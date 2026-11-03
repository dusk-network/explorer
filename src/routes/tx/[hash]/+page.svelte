<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { resolve } from "$app/paths";

  import { Banner } from "$lib/dusk/components";
  import { resolveTransactionId } from "$lib/duskevm/resolveTransactionId";

  let error = false;

  onMount(() => {
    let active = true;
    const hash = $page.params.hash ?? "";

    resolveTransactionId(hash)
      .then(async (transactionId) => {
        if (active) {
          await goto(resolve(`/transactions/transaction?id=${transactionId}`), {
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

<section class="transaction">
  {#if error}
    <Banner title="Transaction link unavailable" variant="error">
      <p>The linked Dusk transaction could not be found.</p>
    </Banner>
  {:else}
    <Banner title="Opening transaction" variant="info">
      <p>Resolving the transaction on Dusk.</p>
    </Banner>
  {/if}
</section>
