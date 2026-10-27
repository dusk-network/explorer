<svelte:options immutable={true} />

<script>
  import { page } from "$app/stores";
  import { AppAnchorButton } from "$lib/components";

  const { error, status } = $page;
</script>

<!-- A page that isn't there, or that failed: said plainly, with the way home. -->
<section class="error-message">
  <p class="error-message__status">Error {status}</p>
  <h1 class="error-message__title">
    {status === 404 ? "Page not found" : "Something went wrong"}
  </h1>
  {#if error?.message && status !== 404}
    <p class="error-message__detail">{error.message}</p>
  {/if}
  <AppAnchorButton
    className="error-message__home"
    href="/"
    text="Home"
    variant="secondary"
  />
</section>

<style lang="postcss">
  .error-message {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    max-width: 40rem;
    padding: 2rem 0;
  }

  .error-message__status {
    margin: 0;
    color: var(--calm-muted);
    font-size: 0.875rem;
  }

  .error-message__title {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .error-message__detail {
    margin: 0;
    color: var(--calm-muted);
    font-family: var(--mono-font-family);
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }

  :global(.error-message__home) {
    margin-top: 1rem;
  }
</style>
