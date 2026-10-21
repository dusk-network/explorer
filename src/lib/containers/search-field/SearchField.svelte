<script>
  import { mdiMagnify } from "@mdi/js";
  import { createEventDispatcher } from "svelte";

  import { TextboxAndButton } from "$lib/components";
  import { isDuskName, resolveDuskName } from "$lib/dusk-domains";
  import { goto } from "$lib/navigation";
  import { duskAPI } from "$lib/services";

  /** @type {String}*/
  let value;

  const errorMessage = "It looks like there is an issue with your input.";

  const dispatch = createEventDispatcher();

  function resetField() {
    value = "";
  }

  function submitHandler() {
    if (value && isDuskName(value)) {
      const query = value;

      resolveDuskName(query)
        .then((address) => goto(`/accounts/?key=${address}`))
        .catch((res) => dispatch("invalid", { query, res }))
        .finally(resetField);
      return;
    }

    const validInputRegex = /^[a-zA-Z0-9]+$/;
    if (!value || !validInputRegex.test(value)) {
      dispatch("invalid", {
        query: value,
        res: new Error("Input must contain only alphanumeric characters"),
      });
      resetField();
      return;
    }

    duskAPI
      .search(value)
      .then((data) => {
        if (!data) {
          dispatch("invalid", {
            query: value,
            res: new Error(errorMessage),
          });
          return;
        }
        switch (data.type) {
          case "block":
            goto(`/blocks/block?id=${data.id}`);
            break;
          case "transaction":
            goto(`/transactions/transaction?id=${data.id}`);
            break;
          case "account":
            goto(`/accounts/?key=${data.id}`);
            break;
          default:
            dispatch("invalid", {
              query: value,
              res: new Error(errorMessage),
            });
        }
      })
      .finally(() => {
        resetField();
      });
  }
</script>

<form on:submit|preventDefault={submitHandler}>
  <TextboxAndButton
    bind:value
    placeholder="Account/Block/Hash"
    icon={{
      path: mdiMagnify,
      position: "after",
      size: "default",
    }}
  />
</form>
