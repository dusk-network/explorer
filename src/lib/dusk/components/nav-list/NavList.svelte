<script>
  import { makeClassName } from "$lib/dusk/string";
  import { AppAnchor } from "$lib/components";
  import { Icon } from "$lib/dusk/components";
  import "./NavList.css";

  /** @type {String | Undefined} */
  export let className = undefined;

  /** @type { NavListProp } */
  export let navigation;

  /**
   * The link of the page shown, which the list marks as the current one.
   *
   * @type {string | undefined}
   */
  export let current = undefined;

  $: classes = makeClassName(["dusk-nav-list", className]);
</script>

{#if navigation}
  <nav {...$$restProps} class={classes}>
    {#each navigation as item, index (`${item.title}-${index}`)}
      <AppAnchor
        aria-current={item.link === current ? "page" : undefined}
        onSurface={false}
        className={makeClassName([
          "dusk-nav-list__link",
          item.link === current ? "dusk-nav-list__link--current" : "",
        ])}
        href={item.link}
        >{#if item.icon}<Icon
            aria-hidden="true"
            className="dusk-nav-list__icon"
            path={item.icon}
          />{/if}<span class="dusk-nav-list__title">{item.title}</span
        ></AppAnchor
      >
    {/each}
  </nav>
{/if}
