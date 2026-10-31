import { createChainStats, duskAPI } from "$lib/services";

import chainHeadStore from "./chainHeadStore";

/** The network's numbers, kept up to date with the chain's newest block. */
export default createChainStats({
  api: {
    getProvisioners: () => duskAPI.getProvisioners(),
    getTxCount: () => duskAPI.getTxCount(),
  },
  head: chainHeadStore,
});
