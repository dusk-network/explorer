<script>
  import { mdiMagnify } from "@mdi/js";
  import { createEventDispatcher } from "svelte";
  import { page } from "$app/stores";

  import { TextboxAndButton } from "$lib/components";
  import { isDuskName, resolveDuskName } from "$lib/dusk-domains";
  import { goto, searchQueryOf } from "$lib/navigation";
  import { duskAPI } from "$lib/services";

  import explainSearchMiss from "./explainSearchMiss";

  /** @type {String}*/
  let value = "";

  /**
   * The searches made so far: only the latest one's answer counts, so a
   * slow miss can't stand in for a newer search's page.
   */
  let searches = 0;

  const dispatch = createEventDispatcher();

  /**
   * Tells why a search found nothing. What was typed stays in the box,
   * to correct it.
   *
   * @param {string} query
   * @param {Error} res
   * @param {string} [suggestion] A `.dusk` name to search instead
   */
  const notFound = (query, res, suggestion) =>
    dispatch("invalid", { query, res, suggestion });

  /** @param {string} query */
  function explainMiss(query) {
    const { message, suggestion } = explainSearchMiss(query);

    notFound(query, new Error(message), suggestion);
  }

  /**
   * Opens what a search found. Found from the page of a search that found
   * nothing, typed, suggested or made again, it takes that page's place in
   * the history: Back then skips the search that found nothing.
   *
   * @param {string} path
   */
  function open(path) {
    value = "";

    return searchQueryOf($page.url) === null
      ? goto(path)
      : goto(path, { replaceState: true });
  }

  /**
   * Searches for the given text, as if typed in the box.
   *
   * @param {string} query
   */
  export function search(query) {
    value = query;
    submitHandler();
  }

  /** Drops the answers of the searches in flight, as after leaving the page. */
  export function cancel() {
    searches += 1;
  }

  function submitHandler() {
    const query = value.trim();
    const current = ++searches;

    /**
     * Runs an answer's step only if no search came after it.
     *
     * @template {any[]} T
     * @param {(...args: T) => unknown} step
     */
    const ifLatest =
      (step) =>
      (/** @type {T} */ ...args) =>
        current === searches ? step(...args) : undefined;

    if (!query) {
      return;
    }

    if (isDuskName(query)) {
      resolveDuskName(query).then(
        ifLatest((address) =>
          open(
            `/accounts/?key=${address}&name=${encodeURIComponent(query.toLowerCase())}`
          )
        ),
        ifLatest((res) => notFound(query, res))
      );
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(query)) {
      explainMiss(query);
      return;
    }

    duskAPI.search(query).then(
      ifLatest((data) => {
        switch (data?.type) {
          case "block":
            return open(`/blocks/block?id=${data.id}`);
          case "transaction":
            return open(`/transactions/transaction?id=${data.id}`);
          case "account":
            return open(`/accounts/?key=${data.id}`);
          default:
            return explainMiss(query);
        }
      }),
      ifLatest(() =>
        notFound(query, new Error("The search failed. Please try again."))
      )
    );
  }
</script>

<form on:submit|preventDefault={submitHandler}>
  <TextboxAndButton
    bind:value
    buttonLabel="Search"
    expandedFieldWidth={380}
    fieldWidth={380}
    label="Search by address, block, transaction or .dusk name"
    placeholder="Address, hash or .dusk name"
    icon={{
      path: mdiMagnify,
      position: "after",
      size: "default",
    }}
  />
</form>
