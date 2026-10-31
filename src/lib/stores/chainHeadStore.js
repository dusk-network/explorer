import { get } from "svelte/store";

import { createChainHead, duskAPI } from "$lib/services";

import appStore from "./appStore";

/**
 * The chain's newest block, for every page that follows the chain: the
 * node announces each block over its websocket, and the last block is read
 * every `fetchInterval` only while it can't.
 */
export default createChainHead({
  interval: get(appStore).fetchInterval,
  read: () => duskAPI.getChainTip(),
});
