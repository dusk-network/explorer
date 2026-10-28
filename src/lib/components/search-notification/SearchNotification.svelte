<script>
  import { Button, Card } from "$lib/dusk/components";
  import { mdiClose } from "@mdi/js";
  import { createEventDispatcher } from "svelte";
  import { makeClassName } from "$lib/dusk/string";
  import "./SearchNotification.css";

  /** @type {{ query: string, res: Error, suggestion?: string }} */
  export let data;

  /** @type {string | Undefined} */
  export let className = undefined;

  const dispatch = createEventDispatcher();

  $: classes = makeClassName(["search-notification", className]);
</script>

<Card className={classes}>
  <header slot="header" class="search-notification__header">
    <span class="search-notification__header-text"
      >Nothing found for <span class="search-notification__content-query"
        >{data.query}</span
      ></span
    >
    <Button
      aria-label="Close"
      className="search-notification__header-action"
      on:click={() => dispatch("close")}
      icon={{
        path: mdiClose,
        position: "after",
        size: "default",
      }}
      variant="tertiary"
    />
  </header>
  <div aria-live="polite" class="search-notification__body">
    <span class="search-notification__content">
      {data.res.message}
    </span>
    {#if data.suggestion}
      <Button
        className="search-notification__suggestion"
        on:click={() => dispatch("suggest", data.suggestion)}
        size="small"
        text="Search {data.suggestion}"
        variant="secondary"
      />
    {/if}
  </div>
</Card>
