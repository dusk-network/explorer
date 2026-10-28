<svelte:options immutable={true} />

<script>
  import { mdiAlertOutline, mdiContentCopy } from "@mdi/js";
  import { Button } from "$lib/dusk/components";
  import { toast } from "$lib/dusk/components/toast/store";
  import { makeClassName } from "$lib/dusk/string";

  import "./CopyButton.css";

  /** @type {string | undefined} */
  export let className = undefined;

  /**
   * What the button copies, in sentence case (e.g. "Transaction ID"):
   * the button is named "Copy transaction ID" and the toast says
   * "Transaction ID copied".
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

  function copyToClipboard() {
    navigator.clipboard
      .writeText(rawValue)
      .then(() => {
        toast("success", `${name} copied`, mdiContentCopy);
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

  $: classes = makeClassName(["dusk-copy-button", className]);
  $: label = `Copy ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
</script>

<div class={classes} {...$$restProps}>
  <Button
    aria-label={label}
    className={classes}
    data-tooltip-id={text ? undefined : "main-tooltip"}
    data-tooltip-text={text ? undefined : "Copy to clipboard"}
    icon={{ path: mdiContentCopy }}
    on:click={copyToClipboard}
    size={text ? "small" : "default"}
    {text}
    {variant}
    {disabled}
  />
</div>
