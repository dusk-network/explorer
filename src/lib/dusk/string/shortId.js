import middleEllipsis from "./middleEllipsis";

/**
 * A Dusk account, a provisioner's key, a hash or a contract's ID, as the
 * explorer shortens it wherever it isn't the page's own: its first and last
 * four characters around "…", the whole on hover and copy. EVM addresses
 * keep their own format.
 *
 * @param {string} id
 * @returns {string}
 */
const shortId = (id) => middleEllipsis(id, 4);

export default shortId;
