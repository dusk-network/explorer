/**
 * The node's GraphQL queries, each with its values written in: the
 * explorer sends a query as plain text and nothing else, which a browser
 * sends to the node without asking it first.
 */

/**
 * A string as a GraphQL string: JSON writes it the way GraphQL reads it.
 *
 * @param {string} value
 */
export const gqlString = (value) => JSON.stringify(String(value));

/**
 * A number as GraphQL writes it. Anything but a finite number is refused,
 * so that a query holds nothing but the number it was given.
 *
 * @param {number} value
 */
export function gqlNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`Not a number for a query: ${value}`);
  }

  return String(value);
}

export const transactionFragment = `
fragment TransactionInfo on SpentTransaction {
	blockHash,
	blockHeight,
	blockTimestamp,
  err,
	gasSpent,
	id,
  tx {
    ${import.meta.env.VITE_FEATURE_BLOB_HASHES === "true" ? "blobHashes," : ""}
    callData {
      contractId,
      data,
      fnName
    },
    gasLimit,
    gasPrice,
    id,
    isDeploy,
    memo,
    txType,
    json
  }
}
`;

const blockFragment = `
${transactionFragment}
fragment BlockInfo on Block {
  header {
    hash,
    gasLimit,
    height,
    prevBlockHash,
    seed,
    stateHash,
    timestamp,
    version
  },
  fees,
  gasSpent,
  reward,
  transactions {...TransactionInfo}
}
`;

/** @param {number} height */
export const getBlockHashQueryInfo = (height) => ({
  query: `
    query { block(height: ${gqlNumber(height)}) { header { hash } } }
  `,
});

/** @param {string} id */
export const getBlockQueryInfo = (id) => ({
  query: `
    ${blockFragment}
    query { block(hash: ${gqlString(id)}) {...BlockInfo} }
  `,
});

/** @param {string} id */
export const getBlockDetailsQueryInfo = (id) => ({
  query: `query { block(hash: ${gqlString(id)}) { header { json } } }`,
});

/** @param {number} amount */
export const getBlocksQueryInfo = (amount) => ({
  query: `
    ${blockFragment}
    query { blocks(last: ${gqlNumber(amount)}) {...BlockInfo} }
  `,
});

/**
 * The hash of the block at height `from`, and the blocks after it up to
 * height `to`, oldest first: the ones the node has.
 *
 * @param {number} from
 * @param {number} to
 */
export const getBlocksAfterQueryInfo = (from, to) => ({
  query: `
    ${blockFragment}
    query {
      anchor: block(height: ${gqlNumber(from)}) { header { hash } },
      blocks(range: [${gqlNumber(from + 1)}, ${gqlNumber(to)}]) {...BlockInfo}
    }
  `,
});

/** @param {number} amount */
export const getLatestChainQueryInfo = (amount) => ({
  query: `
    ${blockFragment}
    query {
      blocks(last: ${gqlNumber(amount)}) {...BlockInfo},
      transactions(last: ${gqlNumber(amount)}) {...TransactionInfo}
    }
  `,
});

/** @param {string} id */
export const getMempoolTx = (id) => ({
  query: `query { mempoolTx(hash: ${gqlString(id)}) { isDeploy } }`,
});

/**
 * An account's public transfers from the archive, both ways: the first
 * `count` each way from height `from`, oldest first, up to height `to`
 * when it is given, from page `page` on; with `tip`, the last block's
 * height too.
 *
 * @param {string} address
 * @param {{ count: number, from: number, page?: number, tip?: boolean, to?: number }} range
 */
export const getMoonlightHistoryQueryInfo = (
  address,
  { count, from, page = 1, tip = false, to }
) => {
  const range = [
    `fromBlock: ${gqlNumber(from)}`,
    ...(to === undefined ? [] : [`toBlock: ${gqlNumber(to)}`]),
    `maxCount: ${gqlNumber(count)}`,
    ...(page > 1 ? [`pageCount: ${gqlNumber(page)}`] : []),
  ].join(", ");

  return {
    query: `
      query {
        ${tip ? "tip: block(height: -1) { header { height } }," : ""}
        sent: moonlightHistory(sender: ${gqlString(address)}, ${range}) { json },
        received: moonlightHistory(receiver: ${gqlString(address)}, ${range}) { json }
      }
    `,
  };
};

/**
 * The hash of the block at height `from`, and the transactions of the
 * blocks after it up to height `to`, with each block's height, hash and
 * previous block's hash, oldest first.
 *
 * @param {number} from
 * @param {number} to
 */
export const getTransactionsAfterQueryInfo = (from, to) => ({
  query: `
    ${transactionFragment}
    query {
      anchor: block(height: ${gqlNumber(from)}) { header { hash } },
      blocks(range: [${gqlNumber(from + 1)}, ${gqlNumber(to)}]) {
        header { hash, height, prevBlockHash },
        transactions {...TransactionInfo}
      }
    }
  `,
});

/**
 * The transactions of ranges of blocks, each range under the alias
 * `r<n>` of its place, oldest block first.
 *
 * @param {number[][]} ranges Each `[from, to]`, both in
 */
export const getTransactionsInQueryInfo = (ranges) => ({
  query: `
    ${transactionFragment}
    query {
      ${ranges.map(([from, to], n) => `r${n}: blockTxs(range: [${gqlNumber(from)}, ${gqlNumber(to)}]) {...TransactionInfo}`).join("\n")}
    }
  `,
});

/**
 * Transactions by their IDs, each under the alias `tx<n>` of its place.
 *
 * @param {string[]} ids
 */
export const getTransactionsByIdQueryInfo = (ids) => ({
  query: `
    ${transactionFragment}
    query {
      ${ids.map((id, n) => `tx${n}: tx(hash: ${gqlString(id)}) { ...TransactionInfo }`).join("\n")}
    }
  `,
});

/** @param {number} amount */
export const getTransactionsQueryInfo = (amount) => ({
  query: `
    ${transactionFragment}
    query { transactions(last: ${gqlNumber(amount)}) {...TransactionInfo} }
  `,
});

/** @param {string} id */
export const getTransactionQueryInfo = (id) => ({
  query: `
    ${transactionFragment}
    query {
      tx(hash: ${gqlString(id)}) {
        ...TransactionInfo
        tx {
          json
        }
      }
    }
  `,
});

/** @param {string} id */
export const searchByHashQueryInfo = (id) => ({
  query: `
    query {
      block(hash: ${gqlString(id)}) { header { hash } },
      tx(hash: ${gqlString(id)}) { id }
    }
  `,
});
