/**
 * Which of the navigation's links a path is under: a block's page is under
 * Blocks, a transaction's under Transactions, and the home page is its own.
 * The base path the explorer is served from doesn't count.
 *
 * @param {string} pathname
 * @param {string[]} links The navigation's links, as "/blocks"
 * @param {string} [base] The base path, as "/explorer"
 * @returns {string | undefined}
 */
function currentPage(pathname, links, base = "") {
  const path =
    base && pathname.startsWith(base)
      ? pathname.slice(base.length) || "/"
      : pathname;

  return links.find((link) =>
    link === "/" ? path === "/" : path === link || path.startsWith(`${link}/`)
  );
}

export default currentPage;
