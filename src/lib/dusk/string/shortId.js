import { shortAccount } from "@dusk-network/networks/format";

/**
 * A Dusk account, a provisioner's key or a hash, as every Dusk app shortens
 * it with `@dusk-network/networks/format`: its first and last six
 * characters around "…". Contract IDs and EVM addresses have their own
 * formats there.
 *
 * @param {string} id
 * @returns {string}
 */
const shortId = (id) => shortAccount(id);

export default shortId;
