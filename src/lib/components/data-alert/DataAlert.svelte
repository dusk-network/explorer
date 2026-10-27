<svelte:options immutable={true} />

<script>
  import { mdiAlertCircleOutline } from "@mdi/js";
  import { Button, Icon } from "$lib/dusk/components";
  import { createEventDispatcher } from "svelte";
  import "./DataAlert.css";

  /** @type {Error | null}*/
  export let error;

  /** What to say when there is nothing to show. */
  export let emptyText = "Nothing to show.";

  const dispatch = createEventDispatcher();
</script>

<!-- A load that failed, and how to try again; or that there is nothing yet. -->
<div class="alert" class:alert--error={!!error}>
  {#if error}
    <p class="alert__title">
      <Icon path={mdiAlertCircleOutline} />Couldn't load this.
    </p>
    {#if error.message}
      <p class="alert__error-message">{error.message}</p>
    {/if}
    <Button
      on:click={() => {
        dispatch("retry");
      }}
      size="small"
      text="Try again"
      variant="secondary"
    />
  {:else}
    <p class="alert__title">{emptyText}</p>
  {/if}
</div>
