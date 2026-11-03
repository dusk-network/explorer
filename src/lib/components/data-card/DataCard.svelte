<svelte:options immutable={true} />

<script>
  import { mdiAlertCircleOutline, mdiChevronRight } from "@mdi/js";
  import { createEventDispatcher } from "svelte";

  import { AppAnchor } from "$lib/components";
  import { Button, Card, Icon, Throbber } from "$lib/dusk/components";
  import { makeClassName } from "$lib/dusk/string";

  import "./DataCard.css";

  /** @type {Block[] | Transaction[] | HostProvisioner[] | Block | Transaction | null}*/
  export let data;

  /** @type {Error | null}*/
  export let error;

  /** @type {Boolean} */
  export let loading;

  /** @type {String}*/
  export let title;

  /** @type {{action:(e: MouseEvent) => void, disabled: boolean, label: String, variant?: ButtonVariant } | undefined}*/
  export let headerButtonDetails = undefined;

  /**
   * The link beside a section's head to the whole list, as "All blocks".
   *
   * @type {{ href: string, label: string } | undefined}
   */
  export let headerLink = undefined;

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

  const dispatch = createEventDispatcher();

  $: classes = makeClassName(["data-card", `data-card--${variant}`, className]);
  $: hasEmptyData = Array.isArray(data) && data.length === 0;
  // What its first load waits for, as its title names it.
  $: loadingWords = `Loading ${variant === "detail" ? "the " : ""}${title.toLowerCase()}…`;
</script>

<Card className={classes}>
  <header slot="header" class="data-card__header">
    <!--
      A page's title as written. A section's head, or the line above a
      detail page's summary, in the ledger's type between brackets that are
      drawn, not read.
    -->
    <svelte:element
      this={variant === "section" ? "h2" : "h1"}
      class="data-card__header-title"
      >{#if variant === "page"}{title}{:else}<span
          aria-hidden="true"
          class="ledger-bracket">[</span
        >{title}<span aria-hidden="true" class="ledger-bracket">]</span
        >{/if}</svelte:element
    >
    {#if headerLink}
      <AppAnchor
        className="data-card__header-link chain-link"
        href={headerLink.href}
        >{headerLink.label}<Icon
          aria-hidden="true"
          path={mdiChevronRight}
          size="small"
        /></AppAnchor
      >
    {/if}
    {#if headerButtonDetails}
      <Button
        className="data-card__header-action"
        disabled={headerButtonDetails.disabled}
        on:click={headerButtonDetails.action}
        size="small"
        text={headerButtonDetails.label}
        variant={headerButtonDetails.variant || "tertiary"}
      />
    {/if}
  </header>
  {#if loading && !data}
    <!-- What it waits for, with the throbber, from the first moment. -->
    <p class="data-card__loading">
      <Throbber />
      <span>{loadingWords}</span>
    </p>
  {:else if error || hasEmptyData}
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
