import { decodeBase58 } from "@dusk-network/networks/account";
import { getKey, getPath, mapWith, setPathIn } from "lamb";

import { unixTsToDate } from "$lib/dusk/date";
import { failureToRejection } from "$lib/dusk/http";
import { makeNodeUrl } from "$lib/url";
import { STAKE_CONTRACT } from "$lib/network";

import {
  addCountAndUnique,
  transformBlock,
  transformSearchResult,
  transformTransaction,
} from "$lib/chain-info";

import {
  getBlockDetailsQueryInfo,
  getBlockHashQueryInfo,
  getBlockQueryInfo,
  getBlocksAfterQueryInfo,
  getBlocksQueryInfo,
  getLatestChainQueryInfo,
  getMempoolTx,
  getTransactionQueryInfo,
  getTransactionsAfterQueryInfo,
  getTransactionsByIdQueryInfo,
  getTransactionsInQueryInfo,
  getTransactionsQueryInfo,
  searchByHashQueryInfo,
} from "./gql-queries";
import { createAccountHistory } from "./accountHistory";

/** @type {(blocks: GQLBlock[]) => Block[]} */
const transformBlocks = mapWith(transformBlock);

/** @type {(transactions: GQLTransaction[]) => Transaction[]} */
const transformTransactions = mapWith(transformTransaction);

/**
 * A query on one line: each run of white space outside its strings as one
 * space.
 *
 * @param {string} query
 */
const oneLine = (query) =>
  query
    .replace(/("(?:[^"\\]|\\.)*")|\s+/g, (match, string) => string ?? " ")
    .trim();

/**
 * A GraphQL query, its values written in, sent as plain text with no
 * headers of its own: a request a browser sends without asking the node
 * first whether it may.
 *
 * @param {{ query: string }} queryInfo
 */
const gqlGet = (queryInfo) =>
  fetch(makeNodeUrl("/on/graphql/query"), {
    body: oneLine(queryInfo.query),
    headers: { "Content-Type": "text/plain" },
    method: "POST",
  })
    .then(failureToRejection)
    .then((res) => res.json());

/**
 * @param {string} endpoint
 * @returns {Promise<any>}
 */
const nodePost = (endpoint) =>
  fetch(makeNodeUrl(endpoint), {
    headers: {
      Accept: "application/json",
      "Accept-Charset": "utf-8",
      Connection: "Keep-Alive",
    },
    method: "POST",
  })
    .then(failureToRejection)
    .then((res) => res.json());

/**
 * The node info request in flight, which callers at the same time share.
 *
 * @type {Promise<NodeInfo> | null}
 */
let nodeInfoRequest = null;

/**
 * The last block's request in flight, which callers at the same time share.
 *
 * @type {Promise<{ date: Date, hash: string, height: number, transactions: number }> | null}
 */
let chainTipRequest = null;

const duskAPI = {
  /**
   * An account's public transactions, newest first, a page at a time
   * (`next(size)`), from the archive.
   *
   * @param {string} address
   */
  accountHistory(address) {
    return createAccountHistory(
      {
        getTransactionsById: (ids) => duskAPI.getTransactionsById(ids),
        query: gqlGet,
      },
      address
    );
  },

  /**
   * @param {string} address
   * @returns {Promise<AccountStatus>}
   */
  getAccountStatus(address) {
    return nodePost(`/on/account:${address}/status`);
  },

  /**
   * @param {string} id
   * @returns {Promise<Block>}
   */
  getBlock(id) {
    return gqlGet(getBlockQueryInfo(id))
      .then(async ({ block }) =>
        setPathIn(
          block,
          "header.nextBlockHash",
          await duskAPI.getBlockHashByHeight(block.header.height + 1)
        )
      )
      .then(transformBlock);
  },

  /**
   * @param {string} id
   * @returns {Promise<string>}
   */
  getBlockDetails(id) {
    return gqlGet(getBlockDetailsQueryInfo(id)).then(
      getPath("block.header.json")
    );
  },

  /**
   * @param {number} height
   * @returns {Promise<string>}
   */
  getBlockHashByHeight(height) {
    return gqlGet(getBlockHashQueryInfo(height)).then(({ block }) =>
      block ? block.header.hash : ""
    );
  },

  /**
   * @param {number} amount
   * @returns {Promise<Block[]>}
   */
  getBlocks(amount) {
    return gqlGet(getBlocksQueryInfo(amount))
      .then(getKey("blocks"))
      .then(transformBlocks);
  },

  /**
   * The blocks after height `from` up to height `to`, newest first as
   * `getBlocks` gives them, and the hash of the block at `from`, which
   * they follow when the chain didn't change in between: the ones the node
   * has, in one query.
   *
   * @param {number} from
   * @param {number} to
   * @returns {Promise<{ anchor: string | null, blocks: Block[] }>}
   */
  getBlocksAfter(from, to) {
    return gqlGet(getBlocksAfterQueryInfo(from, to)).then(
      ({ anchor, blocks }) => ({
        anchor: anchor?.header.hash ?? null,
        blocks: transformBlocks(blocks).reverse(),
      })
    );
  },

  /**
   * The height, hash and time of the last block, and how many transactions
   * it holds, in one query. Callers at the same time share one request.
   *
   * @returns {Promise<{ date: Date, hash: string, height: number, transactions: number }>}
   */
  getChainTip() {
    chainTipRequest ??= gqlGet({
      query:
        "query { block(height: -1) { header { hash height timestamp } transactions { id } } }",
    })
      .then(({ block }) => ({
        date: unixTsToDate(block.header.timestamp),
        hash: block.header.hash,
        height: block.header.height,
        transactions: Array.isArray(block.transactions)
          ? block.transactions.length
          : 0,
      }))
      .finally(() => {
        chainTipRequest = null;
      });

    return chainTipRequest;
  },

  /**
   * @param {number} amount
   * @returns {Promise<ChainInfo>}
   */
  getLatestChainInfo(amount) {
    return gqlGet(getLatestChainQueryInfo(amount)).then(
      ({ blocks, transactions }) => ({
        blocks: transformBlocks(blocks),
        transactions: transformTransactions(transactions),
      })
    );
  },

  /** @returns {Promise<MarketData>} */
  async getMarketData() {
    const COINGECKO_MARKET_URL = new URL(
      "https://api.coingecko.com/api/v3/coins/dusk-network" +
        "?community_data=false" +
        "&developer_data=false" +
        "&localization=false" +
        "&market_data=true" +
        "&sparkline=false" +
        "&tickers=false"
    );

    try {
      // Fetch price data and circulating supply
      const [coinGeckoData, circulatingSupply] = await Promise.all([
        fetch(COINGECKO_MARKET_URL, {
          headers: {
            Accept: "application/json",
            "Accept-Charset": "utf-8",
            Connection: "Keep-Alive",
          },
          method: "GET",
        })
          .then(failureToRejection)
          .then((res) => res.json())
          .then(getKey("market_data")),
        fetch("https://supply.dusk.network/")
          .then(failureToRejection)
          .then((res) => res.text())
          .then((supply) => parseFloat(supply))
          .catch(() => null),
      ]);

      const currentPrice = coinGeckoData.current_price;

      // Calculate market cap using circulating supply if available, fallback to CoinGecko
      /** @type {Record<string, number>} */
      let marketCap;
      if (
        circulatingSupply !== null &&
        !isNaN(circulatingSupply) &&
        currentPrice?.usd
      ) {
        marketCap = {
          usd: circulatingSupply * currentPrice.usd,
        };
        // Add other currencies
        Object.keys(currentPrice).forEach((currency) => {
          if (currency !== "usd" && currentPrice[currency]) {
            marketCap[currency] = circulatingSupply * currentPrice[currency];
          }
        });
      } else {
        // Fallback to CoinGecko's market cap
        marketCap = coinGeckoData.market_cap;
      }

      return {
        currentPrice,
        marketCap,
      };
    } catch (/** @type {any} */ error) {
      throw new Error(`Failed to fetch market data: ${error.message}`);
    }
  },

  /**
   * Callers at the same time share one request.
   *
   * @returns {Promise<NodeInfo>}
   */
  getNodeInfo() {
    nodeInfoRequest ??= nodePost("/on/node/info").finally(() => {
      nodeInfoRequest = null;
    });

    return nodeInfoRequest;
  },

  /**
   * @returns {Promise<{ lat: number, lon: number}[]>}
   */
  getNodeLocations() {
    return nodePost("/on/network/peers_location").then((data) =>
      addCountAndUnique(data)
    );
  },

  /** @returns {Promise<HostProvisioner[]>} */
  getProvisioners() {
    return nodePost("/on/node/provisioners");
  },

  /**
   * The stake of an account's key, or `null` if it has none: one query to
   * the stake contract, which the node answers in JSON. Amounts are in LUX,
   * as exact integers: a stake can pass what a JavaScript number holds
   * exactly.
   *
   * @param {string} address
   * @returns {Promise<AccountStake | null>}
   */
  getStake(address) {
    return fetch(makeNodeUrl(`/on/contracts:${STAKE_CONTRACT}/get_stake`), {
      body: JSON.stringify(address),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    })
      .then(failureToRejection)
      .then((res) => res.json())
      .then(
        /**
         * @param {{
         *   amount: { eligibility: string, locked: string, value: string } | null,
         *   faults: number,
         *   hard_faults: number,
         *   reward: string,
         * } | null} data
         */
        (data) =>
          data
            ? {
                active: BigInt(data.amount?.value ?? 0),
                eligibility: Number(data.amount?.eligibility ?? 0),
                faults: data.faults,
                hardFaults: data.hard_faults,
                inactive: BigInt(data.amount?.locked ?? 0),
                reward: BigInt(data.reward),
              }
            : null
      );
  },

  /**
   * @param {string} id
   * @returns {Promise<Transaction | string>}
   */
  getTransaction(id) {
    return gqlGet(getTransactionQueryInfo(id))
      .then(getKey("tx"))
      .then((tx) => {
        if (tx === null) {
          return gqlGet(getMempoolTx(id))
            .then(getKey("mempoolTx"))
            .then((mempoolTx) => {
              if (mempoolTx) {
                return "This transaction is currently in the mempool and has not yet been confirmed. The transaction details will be displayed after confirmation.";
              } else {
                throw new Error("Transaction not found");
              }
            });
        } else {
          return transformTransaction(tx);
        }
      });
  },

  /**
   * @param {number} amount
   * @returns {Promise<Transaction[]>}
   */
  getTransactions(amount) {
    return gqlGet(getTransactionsQueryInfo(amount))
      .then(getKey("transactions"))
      .then(transformTransactions);
  },

  /**
   * The transactions of the blocks after height `from` up to height `to`,
   * newest first as `getTransactions` gives them, those blocks' heights,
   * hashes and previous blocks' hashes, newest first, and the hash of the
   * block at `from`: the ones the node has, in one query.
   *
   * @param {number} from
   * @param {number} to
   * @returns {Promise<{ anchor: string | null, blocks: { hash: string, height: number, prevblockhash: string }[], transactions: Transaction[] }>}
   */
  getTransactionsAfter(from, to) {
    return gqlGet(getTransactionsAfterQueryInfo(from, to)).then(
      ({ anchor, blocks }) => {
        /** @type {{ header: { hash: string, height: number, prevBlockHash: string }, transactions: GQLTransaction[] }[]} */
        const newestFirst = [...blocks].reverse();

        return {
          anchor: anchor?.header.hash ?? null,
          blocks: newestFirst.map(({ header }) => ({
            hash: header.hash,
            height: header.height,
            prevblockhash: header.prevBlockHash,
          })),
          transactions: newestFirst.flatMap((block) =>
            transformTransactions(block.transactions)
          ),
        };
      }
    );
  },

  /**
   * Transactions by their IDs, in their order, in one query; those the
   * node doesn't have are left out.
   *
   * @param {string[]} ids
   * @returns {Promise<Transaction[]>}
   */
  getTransactionsById(ids) {
    return ids.length
      ? gqlGet(getTransactionsByIdQueryInfo(ids)).then((found) =>
          ids
            .map((_, n) => found?.[`tx${n}`])
            .filter(Boolean)
            .map(transformTransaction)
        )
      : Promise.resolve([]);
  },

  /**
   * The transactions of ranges of blocks, each of the node's bound or
   * less, in one query: newest block first, and in a block in its order,
   * as `getTransactions` gives them.
   *
   * @param {number[][]} ranges Each `[from, to]`, both in
   * @returns {Promise<Transaction[]>}
   */
  getTransactionsIn(ranges) {
    return gqlGet(getTransactionsInQueryInfo(ranges)).then((found) =>
      transformTransactions(
        ranges
          .flatMap((_, n) => found?.[`r${n}`] ?? [])
          .sort((a, b) => b.blockHeight - a.blockHeight)
      )
    );
  },

  /**
   * @returns {Promise<{ public: number; shielded: number; total: number }>}
   */
  getTxCount() {
    return nodePost("/on/stats/tx_count");
  },

  /**
   * Search function that handles different query formats:
   * 1. 64-character hexadecimal strings (likely transaction or block hashes)
   * 2. Numeric strings (likely block heights)
   * 3. Base58-encoded strings with a decoded length of 96 bytes (likely addresses)
   *
   * @param {string} query - The search query string
   * @returns {Promise<SearchResult|null>} - Promise resolving to transformed search result
   */
  async search(query) {
    let searchPromise;

    // Case 1: Handle 64-character hexadecimal strings (likely tx or block hashes)
    if (query.length === 64) {
      searchPromise = gqlGet(searchByHashQueryInfo(query));
    }

    // Case 2: Handle numeric strings (likely block heights)
    else if (/^\d+$/.test(query)) {
      searchPromise = gqlGet(getBlockHashQueryInfo(+query));
    }

    // Case 3: Handle potential base58-encoded addresses
    else {
      const bytes = decodeBase58(query);
      // If decoded length is 96 bytes, it's likely an address
      if (bytes?.length === 96) {
        searchPromise = Promise.resolve({ account: { id: query } });
      } else {
        searchPromise = Promise.resolve(null);
      }
    }

    const entry = await searchPromise;
    const result = entry ? transformSearchResult(entry) : null;
    return result;
  },
};

export default duskAPI;
