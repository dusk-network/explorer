<svelte:options immutable={true} />

<script>
  import { mdiChevronRight } from "@mdi/js";

  import { DataAlert } from "$lib/components";
  import { Button, Card, ProgressBar } from "$lib/dusk/components";
  import { makeClassName } from "$lib/dusk/string";

  import "./DataCard.css";

  /** @type {Block[] | Transaction[] | HostProvisioner[] | Block | Transaction | Token[] | null}*/
  export let data;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {String}*/
  export let title;

  /** @type {{action:(e: MouseEvent) => void, disabled: boolean, label: String, variant?: ButtonVariant } | undefined}*/
  export let headerButtonDetails = undefined;

  /** @type {string | Undefined} */
  export let className = undefined;

  /** What the card says when there is nothing to show. */
  export let emptyText = "Nothing to show.";

  /**
   * How the title reads: a page's heading, the heading of a section of the
   * home page, with its link to the whole list beside it, or the small line
   * above a detail page's summary.
   *
   * @type {"page" | "section" | "detail"}
   */
  export let variant = "page";

  $: classes = makeClassName(["data-card", `data-card--${variant}`, className]);
  $: hasEmptyData = Array.isArray(data) && data.length === 0;
</script>

<Card className={classes}>
  <header slot="header" class="data-card__header">
    <svelte:element
      this={variant === "section" ? "h2" : "h1"}
      class="data-card__header-title">{title}</svelte:element
    >
    {#if headerButtonDetails}
      <Button
        className="data-card__header-action"
        disabled={headerButtonDetails.disabled}
        icon={variant === "section"
          ? { path: mdiChevronRight, position: "after", size: "small" }
          : undefined}
        on:click={headerButtonDetails.action}
        size="small"
        text={headerButtonDetails.label}
        variant={headerButtonDetails.variant || "tertiary"}
      />
    {/if}
  </header>
  {#if loading && !data}
    <ProgressBar ariaLabel="Loading" className="data-card__progress-bar" />
  {:else if error || hasEmptyData}
    <DataAlert on:retry {emptyText} {error} />
  {:else if data}
    <div class="data-card__content">
      <slot />
    </div>
    {#if $$slots.footer}
      <footer class="data-card__footer">
        <slot name="footer" />
      </footer>
    {/if}
  {/if}
</Card>
