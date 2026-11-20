<script>
  import { Button, Card } from "$lib/dusk/components";
  import { mdiClose } from "@mdi/js";
  import { createEventDispatcher } from "svelte";
  import { makeClassName, shortId } from "$lib/dusk/string";
  import "./SearchNotification.css";

  /** @type {{ query: string, res: Error, suggestion?: string }} */
  export let data;

  /** @type {string | Undefined} */
  export let className = undefined;

  const dispatch = createEventDispatcher();

  $: classes = makeClassName(["search-notification", className]);

  // A whole ID or address, short as every Dusk app shortens one: the search
  // field keeps it whole.
  $: shownQuery = /^[0-9a-z]{24,}$/i.test(data.query)
    ? shortId(data.query)
    : data.query;
</script>

<Card className={classes}>
  <header slot="header" class="search-notification__header">
    <span class="search-notification__header-text"
      >Nothing found for <span class="search-notification__content-query"
        >{shownQuery}</span
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
