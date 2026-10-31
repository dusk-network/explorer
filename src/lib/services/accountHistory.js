/**
 * An account's public transactions, newest first, a page at a time.
 *
 * The archive lists the transfers an account sent, and those it received,
 * each oldest first from a height, `PAGE` at a time (`moonlightHistory`).
 * The first read asks for the first of them from the first block, with the
 * last block's height: for most accounts, that is all there is. For one
 * with more, the heights under the last block are read from the top down,
 * in windows: a day of blocks first, then wider while they hold few,
 * narrower where a page fills. Each page's transactions come in one query.
 */

import { getMoonlightHistoryQueryInfo } from "./gql-queries";

/** The transfers each way one read gives: the archive's page. */
export const PAGE = 50;

/** The first window under the last block: about a day of blocks. */
export const FIRST_WINDOW = 8_640;

/** @typedef {{ height: number, origin: string }} Entry */

/** @typedef {{ lo: number, hi: number, entries: Entry[] }} Covered */

/**
 * What one read of both directions gave: their entries, how many the
 * fuller one held, whether one came back full, and the height up to which
 * every entry is in.
 *
 * @typedef {{ completeTo: number, count: number, entries: Entry[], full: boolean }} RangeRead
 */

/**
 * @typedef {{
 *   query: (queryInfo: { query: string }) => Promise<any>,
 *   getTransactionsById: (ids: string[]) => Promise<Transaction[]>,
 * }} HistoryReader
 */

/**
 * The entries of one direction's answer, as the archive lists them.
 *
 * @param {any} field
 * @returns {Entry[]}
 */
const entriesOf = (field) =>
  (Array.isArray(field?.json) ? field.json : [])
    .map((/** @type {any} */ item) => ({
      height: Number(item?.block_height),
      origin: String(item?.origin ?? ""),
    }))
    .filter(
      (/** @type {Entry} */ entry) =>
        Number.isSafeInteger(entry.height) &&
        /^[0-9a-f]{64}$/i.test(entry.origin)
    );

/**
 * Newest block first, and in a block by transaction ID, as a whole history
 * lists them the other way round.
 *
 * @param {Entry} a
 * @param {Entry} b
 */
const newerFirst = (a, b) =>
  a.height !== b.height
    ? b.height - a.height
    : a.origin < b.origin
      ? -1
      : Number(a.origin > b.origin);

/**
 * Entries each once, newest first: a transfer to itself is listed both
 * ways.
 *
 * @param {Entry[]} entries
 * @returns {Entry[]}
 */
const newestFirst = (entries) =>
  [...new Map(entries.map((entry) => [entry.origin, entry])).values()].sort(
    newerFirst
  );

/**
 * One read of both directions' lists.
 *
 * @param {any} answer
 * @param {number} to The highest height asked for
 * @returns {RangeRead}
 */
function rangeOf(answer, to) {
  const lists = [entriesOf(answer?.sent), entriesOf(answer?.received)];
  const full = lists.filter((list) => list.length >= PAGE);

  return {
    // Under the last entry of each full list, every entry is in.
    completeTo: full.length
      ? Math.min(...full.map((list) => list[list.length - 1].height - 1))
      : to,
    count: Math.max(...lists.map((list) => list.length)),
    entries: lists.flat(),
    full: full.length > 0,
  };
}

/**
 * The next window after one whose fuller direction held `count` entries:
 * eight times wider under a quarter page, twice under half.
 *
 * @param {number} window
 * @param {number} count
 */
const wider = (window, count) =>
  count < PAGE / 4 ? window * 8 : count < PAGE / 2 ? window * 2 : window;

/**
 * The heights read already that the cursor reached, if any.
 *
 * @param {Covered[]} below
 * @param {number} cursor
 */
const reachedAt = (below, cursor) => below.find((range) => range.hi === cursor);

/**
 * The highest height read already under the cursor, or -1.
 *
 * @param {Covered[]} below
 * @param {number} cursor
 */
const floorUnder = (below, cursor) =>
  Math.max(
    -1,
    ...below.filter((range) => range.hi < cursor).map((range) => range.hi)
  );

/**
 * An account's public transactions, a page at a time: `next(size)` gives
 * the next `size` of them, newest first, and whether that was the last.
 *
 * @param {HistoryReader} api
 * @param {string} address
 */
export function createAccountHistory(api, address) {
  const at = {
    /** Heights read under the cursor, not reached yet, highest first. */
    below: /** @type {Covered[]} */ ([]),

    /** The highest height not read yet; -1 once all are. */
    cursor: -1,

    /** Entries read and not given yet, newest first. */
    pending: /** @type {Entry[]} */ ([]),

    started: false,
    window: FIRST_WINDOW,
  };

  /** @type {Promise<unknown>} */
  let last = Promise.resolve();

  /** @param {{ from: number, page?: number, tip?: boolean, to?: number }} range */
  const read = (range) =>
    api.query(getMoonlightHistoryQueryInfo(address, { count: PAGE, ...range }));

  /**
   * Gives entries, and moves the cursor under them.
   *
   * @param {Entry[]} entries
   * @param {number} lo The lowest height they cover
   */
  function take(entries, lo) {
    at.pending.push(...newestFirst(entries));
    at.cursor = lo - 1;
  }

  /**
   * The first read: the first page each way from the first block, and the
   * last block's height.
   */
  async function readStart() {
    const answer = await read({ from: 0, tip: true });
    const top = Number(answer?.tip?.header?.height);

    if (!Number.isSafeInteger(top)) {
      throw new Error("The last block couldn't be read");
    }

    const { completeTo, entries, full } = rangeOf(answer, top);
    // Newer than the last block read, as the archive may already have
    // them: they come with the next visit.
    const upToTop = entries.filter((entry) => entry.height <= top);

    if (!full) {
      take(upToTop, 0);

      return;
    }

    const hi = Math.min(top, completeTo);

    at.below =
      hi >= 0
        ? [
            {
              entries: newestFirst(upToTop.filter((e) => e.height <= hi)),
              hi,
              lo: 0,
            },
          ]
        : [];
    at.cursor = top;
  }

  /**
   * A block with more than a page: its pages, one after another.
   *
   * @param {number} height
   * @param {RangeRead} first
   */
  async function readCrowded(height, first) {
    const entries = [...first.entries];

    for (let n = 2, more = first.full; more; n += 1) {
      const next = rangeOf(
        await read({ from: height, page: n, to: height }),
        height
      );

      entries.push(...next.entries);
      more = next.full;
    }

    return entries;
  }

  /**
   * After a page filled: what is under its last entry is in, and the
   * heights above it are read in windows sized to fill about half a page.
   * One that filled in its lowest block, which holds more than a page, has
   * the heights above that block read first, then its pages.
   *
   * @param {RangeRead} range
   * @param {number} from
   */
  function narrow(range, from) {
    if (range.completeTo < from) {
      at.window = Math.max(1, at.cursor - from);

      return;
    }

    const hi = range.completeTo;

    at.below = [
      ...at.below,
      {
        entries: newestFirst(range.entries.filter((e) => e.height <= hi)),
        hi,
        lo: from,
      },
    ].sort((a, b) => b.hi - a.hi);
    at.window = Math.max(1, Math.floor((hi - from + 2) / 2));
  }

  /** One step down from the cursor: heights read already, or a window. */
  async function step() {
    const reached = reachedAt(at.below, at.cursor);

    if (reached) {
      at.below = at.below.filter((range) => range !== reached);
      take(reached.entries, reached.lo);

      return;
    }

    const from = Math.max(
      floorUnder(at.below, at.cursor) + 1,
      at.cursor - at.window + 1
    );
    const range = rangeOf(await read({ from, to: at.cursor }), at.cursor);

    if (!range.full) {
      take(range.entries, from);
      at.window = wider(at.window, range.count);
    } else if (from === at.cursor) {
      take(await readCrowded(from, range), from);
    } else {
      narrow(range, from);
    }
  }

  /**
   * @param {number} size
   * @returns {Promise<{ transactions: Transaction[], done: boolean }>}
   */
  async function nextPage(size) {
    if (!at.started) {
      await readStart();
      at.started = true;
    }

    while (at.pending.length < size && at.cursor >= 0) {
      await step();
    }

    const entries = at.pending.splice(0, size);
    const transactions = entries.length
      ? await api.getTransactionsById(entries.map((entry) => entry.origin))
      : [];

    return {
      done: at.cursor < 0 && !at.pending.length && !at.below.length,
      transactions,
    };
  }

  return {
    /**
     * The next `size` transactions, newest first; one call at a time.
     *
     * @param {number} size
     */
    next(size) {
      const result = last.then(() => nextPage(size));

      last = result.catch(() => {});

      return result;
    },
  };
}
