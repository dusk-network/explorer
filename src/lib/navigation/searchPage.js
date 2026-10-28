import { base } from "$app/paths";

/** The page of a search that found nothing, its query in `q`. */
const SEARCH_PATH = "/search/";

/**
 * The search page's address for a query, as `goto` takes it.
 *
 * @param {string} query
 */
export const searchPagePath = (query) =>
  `${SEARCH_PATH}?q=${encodeURIComponent(query)}`;

/**
 * The search a page's address holds: the search page's query, or `null` on
 * any other page.
 *
 * @param {URL | null | undefined} url
 * @returns {string | null}
 */
export const searchQueryOf = (url) =>
  url?.pathname === `${base}${SEARCH_PATH}`
    ? (url.searchParams.get("q") ?? "").trim()
    : null;
