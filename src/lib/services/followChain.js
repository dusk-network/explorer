/**
 * The latest blocks and transactions, kept up to date by asking the node
 * only for what is new: the first read asks for the whole list, and each
 * read after it only for the blocks from the newest one it has. When that
 * block is no longer the chain's at its height, or more blocks came than a
 * read takes, the read asks for the whole list again.
 *
 * Each read gives new objects for the entries, as a whole list would, so
 * that the rows showing them are drawn again, with their times.
 */

/** The most blocks one range read takes: the node's bound. */
const MAX_RANGE = 200;

/** @typedef {{ hash: string, height: number }} BlockRef */

/**
 * @typedef {{
 *   getBlocks: (amount: number) => Promise<Block[]>,
 *   getBlocksInRange: (from: number, to: number) => Promise<Block[]>,
 * }} BlocksReader
 */

/**
 * @typedef {BlocksReader & {
 *   getLatestChainInfo: (amount: number) => Promise<ChainInfo>,
 * }} ChainInfoReader
 */

/**
 * @typedef {{
 *   getChainTip: () => Promise<BlockRef>,
 *   getTransactions: (amount: number) => Promise<Transaction[]>,
 *   getTransactionsInRange: (
 *     from: number,
 *     to: number
 *   ) => Promise<{ blocks: BlockRef[], transactions: Transaction[] }>,
 * }} TransactionsReader
 */

/**
 * Runs the reads one after another, so that each starts from the list the
 * one before it left. A read with none before it starts at once.
 *
 * @template T
 * @param {(amount: number) => Promise<T>} read
 * @returns {(amount: number) => Promise<T>}
 */
function oneAtATime(read) {
  /** @type {Promise<unknown> | null} */
  let running = null;

  return (amount) => {
    const next = running ? running.then(() => read(amount)) : read(amount);
    const settled = next.catch(() => {});

    running = settled;
    settled.then(() => {
      if (running === settled) {
        running = null;
      }
    });

    return next;
  };
}

/**
 * @template T
 * @param {T[]} entries
 * @returns {T[]}
 */
const copies = (entries) => entries.map((entry) => ({ ...entry }));

/**
 * The heights a range read asks for after a block: one more than a list of
 * `amount` takes, so that a full read says more blocks may follow.
 *
 * @param {number} amount
 */
const spanFor = (amount) => Math.min(amount, MAX_RANGE - 1);

/**
 * Whether a range read from the height of `newest` carries on from it: the
 * chain still has `newest` at that height, and the read wasn't full, as
 * more blocks may follow it then.
 *
 * @param {BlockRef[]} range The blocks read, newest first
 * @param {BlockRef} newest
 * @param {number} span
 */
function carriesOn(range, newest, span) {
  const first = range.at(-1);

  return (
    !!first &&
    first.height === newest.height &&
    first.hash === newest.hash &&
    range.length <= span
  );
}

/** @type {(block: Block) => BlockRef} */
const refOf = ({ header }) => ({ hash: header.hash, height: header.height });

/**
 * The blocks after the newest of `held`, newest first, or `null` when the
 * whole list must be read again.
 *
 * @param {BlocksReader} api
 * @param {Block[]} held Newest first
 * @param {number} amount
 * @returns {Promise<Block[] | null>}
 */
async function readBlocksAfter(api, held, amount) {
  if (!held.length) {
    return null;
  }

  const newest = refOf(held[0]);
  const span = spanFor(amount);
  const range = await api.getBlocksInRange(newest.height, newest.height + span);

  return carriesOn(range.map(refOf), newest, span) ? range.slice(0, -1) : null;
}

/**
 * The newest `limit` transactions, each once: `fresh` ahead of `held`.
 *
 * @param {Transaction[]} fresh Newer than the ones of `held` it doesn't repeat
 * @param {Transaction[]} held
 * @param {number} limit
 * @returns {Transaction[]}
 */
function newestTransactions(fresh, held, limit) {
  const seen = new Set();

  return [...fresh, ...held]
    .filter(({ txid }) => !seen.has(txid) && seen.add(txid))
    .slice(0, limit);
}

/**
 * The transactions of the blocks above `height`, newest first.
 *
 * @param {Block[]} blocks Newest first
 * @param {number} height
 */
const transactionsAbove = (blocks, height) =>
  blocks
    .filter((block) => block.header.height > height)
    .flatMap((block) => block.transactions.data);

/**
 * The last `amount` blocks.
 *
 * @param {BlocksReader} api
 * @returns {(amount: number) => Promise<Block[]>}
 */
export function followBlocks(api) {
  /** @type {Block[]} */
  let held = [];
  let heldFor = 0;

  return oneAtATime(async (amount) => {
    try {
      const fresh =
        amount === heldFor ? await readBlocksAfter(api, held, amount) : null;

      held = (fresh ? [...fresh, ...held] : await api.getBlocks(amount)).slice(
        0,
        amount
      );
      heldFor = amount;

      return copies(held);
    } catch (error) {
      held = [];
      heldFor = 0;

      throw error;
    }
  });
}

/**
 * The last `amount` blocks and the last `amount` transactions, as the home
 * page lists them: after the first read, the new transactions come with the
 * new blocks.
 *
 * @param {ChainInfoReader} api
 * @returns {(amount: number) => Promise<ChainInfo>}
 */
export function followChainInfo(api) {
  /** @type {ChainInfo} */
  let held = { blocks: [], transactions: [] };
  let heldFor = 0;

  /**
   * The whole lists. The blocks and the transactions are read in one query
   * but not at one instant: a block the transactions missed adds its own.
   *
   * @type {(amount: number) => Promise<ChainInfo>}
   */
  async function readAll(amount) {
    const { blocks, transactions } = await api.getLatestChainInfo(amount);

    return {
      blocks,
      transactions: newestTransactions(
        transactionsAbove(blocks, transactions[0]?.blockheight ?? -1),
        transactions,
        amount
      ),
    };
  }

  return oneAtATime(async (amount) => {
    try {
      const fresh =
        amount === heldFor
          ? await readBlocksAfter(api, held.blocks, amount)
          : null;
      const info = fresh
        ? {
            blocks: [...fresh, ...held.blocks],
            transactions: newestTransactions(
              transactionsAbove(fresh, -1),
              held.transactions,
              amount
            ),
          }
        : await readAll(amount);

      held = {
        blocks: info.blocks.slice(0, amount),
        transactions: info.transactions.slice(0, amount),
      };
      heldFor = amount;

      return {
        blocks: copies(held.blocks),
        transactions: copies(held.transactions),
      };
    } catch (error) {
      held = { blocks: [], transactions: [] };
      heldFor = 0;

      throw error;
    }
  });
}

/**
 * The last `amount` transactions: after the first read, only those of the
 * blocks after the last block it saw.
 *
 * @param {TransactionsReader} api
 * @returns {(amount: number) => Promise<Transaction[]>}
 */
export function followTransactions(api) {
  /** @type {Transaction[]} */
  let held = [];
  let heldFor = 0;

  /**
   * The last block whose transactions `held` has.
   *
   * @type {BlockRef | null}
   */
  let seen = null;

  /**
   * The transactions after the last block seen, ahead of `held`, or `null`
   * when the whole list must be read again.
   *
   * @param {BlockRef} last
   * @param {number} amount
   * @returns {Promise<Transaction[] | null>}
   */
  async function readNew(last, amount) {
    const span = MAX_RANGE - 1;
    const from = last.height;
    const range = await api.getTransactionsInRange(from, from + span);

    if (!carriesOn(range.blocks, last, span)) {
      return null;
    }

    seen = range.blocks[0];

    return newestTransactions(
      range.transactions.filter(({ blockheight }) => blockheight > from),
      held,
      amount
    );
  }

  /**
   * The whole list, read after the last block: every transaction up to that
   * block is in it, and one after it comes again with its block, once.
   *
   * @type {(amount: number) => Promise<Transaction[]>}
   */
  async function readAll(amount) {
    const tip = await api.getChainTip();
    const transactions = await api.getTransactions(amount);

    seen = { hash: tip.hash, height: tip.height };

    return transactions;
  }

  return oneAtATime(async (amount) => {
    try {
      const fresh =
        seen && amount === heldFor ? await readNew(seen, amount) : null;

      held = (fresh ?? (await readAll(amount))).slice(0, amount);
      heldFor = amount;

      return copies(held);
    } catch (error) {
      held = [];
      heldFor = 0;
      seen = null;

      throw error;
    }
  });
}
