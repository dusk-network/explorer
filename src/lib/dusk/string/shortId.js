import middleEllipsis from "./middleEllipsis";

/**
 * A Dusk account, a provisioner's key, a hash or a contract's ID, short: its
 * first and last six characters around "…", as every Dusk app shortens one.
 * A phone's row, too narrow for six, keeps four. Where the value is what
 * someone checks, the page gives it whole; the whole is always a copy away.
 * EVM addresses keep their own format.
 *
 * @param {string} id
 * @param {number} [length] The characters kept at each end
 * @returns {string}
 */
const shortId = (id, length = 6) => middleEllipsis(id, length);

export default shortId;
