<svelte:options immutable={true} />

<script>
  import { mdiAlertOutline, mdiCheck, mdiContentCopy } from "@mdi/js";
  import { onDestroy } from "svelte";
  import { Button } from "$lib/dusk/components";
  import { toast } from "$lib/dusk/components/toast/store";
  import { announce } from "$lib/dusk/announce";
  import { COPIED_FOR } from "$lib/dusk/motion";
  import { makeClassName } from "$lib/dusk/string";

  import "./CopyButton.css";

  /** @type {string | undefined} */
  export let className = undefined;

  /**
   * What the button copies, in sentence case (e.g. "Transaction ID"):
   * the button is named "Copy transaction ID".
   *
   * @type {string}
   */
  export let name;

  /** @type {string} */
  export let rawValue;

  /** @type {boolean} */
  export let disabled = false;

  /** @type {ButtonVariant} */
  export let variant = "tertiary";

  /**
   * A word to show beside the icon, as the details' "Copy". Without it the
   * button is the icon alone, with a tooltip.
   *
   * @type {string | undefined}
   */
  export let text = undefined;

  /**
   * What it just copied: it says Copied for a moment, while that's still
   * the value it copies.
   *
   * @type {string | undefined}
   */
  let justCopied = undefined;

  let timer = 0;

  function copyToClipboard() {
    const copying = rawValue;

    navigator.clipboard
      .writeText(copying)
      .then(() => {
        // Said where it was pressed: a check, the word Copied, and once
        // to screen readers.
        justCopied = copying;
        announce("Copied", COPIED_FOR);
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          justCopied = undefined;
        }, COPIED_FOR);
      })
      .catch((err) => {
        toast(
          "error",
          err.name === "NotAllowedError"
            ? "Clipboard access denied"
            : err.message,
          mdiAlertOutline
        );
      });
  }

  onDestroy(() => clearTimeout(timer));

  $: copied = justCopied !== undefined && justCopied === rawValue;
  $: classes = makeClassName(["dusk-copy-button", className]);
  $: label = `Copy ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
</script>

<div class={classes} {...$$restProps}>
  <Button
    aria-label={copied ? "Copied" : label}
    className={classes}
    data-tooltip-id={text ? undefined : "main-tooltip"}
    data-tooltip-text={text ? undefined : "Copy to clipboard"}
    icon={{ path: copied ? mdiCheck : mdiContentCopy }}
    on:click={copyToClipboard}
    size={text ? "small" : "default"}
    text={text && copied ? "Copied" : text}
    {variant}
    {disabled}
  />
</div>
