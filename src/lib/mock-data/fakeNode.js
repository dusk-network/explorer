/* istanbul ignore file */

/**
 * A node for tests: a chain of blocks, the GraphQL the explorer asks of it
 * (its values written in, or given as `Rusk-gqlvar-` headers), its HTTP
 * endpoints, the archive's `moonlightHistory`, and its websocket, which
 * announces each block it accepts to the sessions subscribed. Every request
 * is logged, as the explorer sent it.
 */

import apiMarketData from "./api-market-data.json";
import apiNodeInfo from "./api-node-info.json";
import apiNodeLocations from "./api-node-locations.json";
import gqlTransactions from "./gql-transactions.json";
import hostProvisioners from "./host-provisioners.json";

/**
 * @typedef {{
 *   body: string,
 *   fields: string[],
 *   headers: Record<string, string>,
 *   method: string,
 *   path: string,
 *   url: string,
 * }} Logged
 */

/** @typedef {{ height: number, origin: string }} Transfer */

/** @typedef {{ sent: Transfer[], received: Transfer[] }} Transfers */

/** @typedef {{ hash: string, height: number, timestamp: number, transactions: any[] }} FakeBlock */

/** @typedef {{ alias: string, args: Record<string, any>, name: string, selection: string }} Field */

/**
 * @param {string} kind One hex digit
 * @param {number} n
 */
const hashOf = (kind, n) => `${kind}${n.toString(16).padStart(63, "0")}`;

/** @param {number} height */
const blockHash = (height) => hashOf("b", height);

/**
 * A query with its `Rusk-gqlvar-` headers written in, as the node reads them.
 *
 * @param {string} query
 * @param {Record<string, string>} headers
 */
function withVariables(query, headers) {
  /** @type {Record<string, unknown>} */
  const variables = {};

  for (const [key, value] of Object.entries(headers)) {
    if (/^rusk-gqlvar-/i.test(key)) {
      variables[key.replace(/^rusk-gqlvar-/i, "")] = JSON.parse(value);
    }
  }

  return query
    .replace(/query\s*\w*\s*\((\s*\$\w+\s*:\s*[\w![\]]+\s*,?)+\)/, "query")
    .replace(/\$(\w+)/g, (_, name) => JSON.stringify(variables[name]));
}

/**
 * The selection at `i`, from its "{" to its "}", and where it ends.
 *
 * @param {string} text
 * @param {number} i
 */
function selectionAt(text, i) {
  if (text[i] !== "{") {
    return { end: i, selection: "" };
  }

  let depth = 0;
  let end = i;

  do {
    depth += text[end] === "{" ? 1 : text[end] === "}" ? -1 : 0;
    end += 1;
  } while (depth > 0 && end < text.length);

  return { end, selection: text.slice(i, end) };
}

/**
 * The fields inside the operation's braces, after any fragments.
 *
 * @param {string} query
 */
function operationOf(query) {
  const start = /(?:^|[\s}])query\b[^{]*/.exec(query);
  const from = start ? start.index + start[0].length : query.indexOf("{");

  return selectionAt(query, from).selection.slice(1, -1);
}

/**
 * A field's arguments: numbers, strings and lists of numbers.
 *
 * @param {string | undefined} raw
 */
function argsOf(raw) {
  /** @type {Record<string, any>} */
  const args = {};

  for (const [, key, value] of (raw ?? "").matchAll(
    /(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\]|-?[\d.]+)/g
  )) {
    args[key] = JSON.parse(value);
  }

  return args;
}

const FIELD = /^[\s,]*(?:(\w+)\s*:\s*)?(\w+)\s*(?:\(([^)]*)\))?\s*/;

/**
 * The top-level fields a query asks, each with its alias and arguments.
 *
 * @param {string} query
 * @returns {Field[]}
 */
function fieldsOf(query) {
  /** @type {Field[]} */
  const fields = [];
  let rest = operationOf(query);

  for (let match = FIELD.exec(rest); match?.[2]; match = FIELD.exec(rest)) {
    const [whole, alias, name, raw] = match;
    const { end, selection } = selectionAt(rest, whole.length);

    fields.push({ alias: alias ?? name, args: argsOf(raw), name, selection });
    rest = rest.slice(end);
  }

  return fields;
}

/** @param {Transfer} entry */
const asGroup = (entry) => ({
  // eslint-disable-next-line camelcase
  block_height: entry.height,
  events: [],
  origin: entry.origin,
});

/**
 * The archive's paging of one direction's list, oldest first.
 *
 * @param {Transfer[]} list
 * @param {Record<string, any>} args
 */
function pageOf(list, { fromBlock = 0, maxCount, pageCount = 1, toBlock }) {
  const kept = list
    .filter(
      (entry) =>
        entry.height >= fromBlock &&
        (toBlock === undefined || entry.height <= toBlock)
    )
    .sort((a, b) => a.height - b.height);
  const picked =
    maxCount === undefined
      ? kept
      : kept.slice((pageCount - 1) * maxCount, pageCount * maxCount);

  return picked.length ? { json: picked.map(asGroup) } : null;
}

/**
 * The blocks and transactions of a chain whose tip came now, a block every
 * ten seconds before it, by a clock `behind` the page's.
 *
 * @param {{ behind: number, history: Map<string, Transfers>, tip: number, transactions: number[] }} options
 */
function createChain({ behind, history, tip, transactions }) {
  const nodeNow = () => Math.floor((Date.now() - behind) / 1000);
  const startedAt = nodeNow();
  /** @type {Map<number, FakeBlock>} */
  const blocks = new Map();
  /** @type {Map<string, any>} */
  const txs = new Map();
  /** @param {number} height */
  const timeAt = (height) =>
    height <= tip ? startedAt - (tip - height) * 10 : nodeNow();
  let serial = 0;

  /**
   * @param {string} id
   * @param {number} height
   */
  function transactionOf(id, height) {
    const template = gqlTransactions.transactions[serial % 100];
    const tx = {
      ...template,
      blockHash: blockHash(height),
      blockHeight: height,
      blockTimestamp: timeAt(height),
      id,
      tx: { ...template.tx, id },
    };

    serial += 1;
    txs.set(id, tx);

    return tx;
  }

  /**
   * @param {number} height
   * @param {number} count
   */
  function makeBlock(height, count) {
    /** @type {FakeBlock} */
    const block = {
      hash: blockHash(height),
      height,
      timestamp: timeAt(height),
      transactions: Array.from({ length: count }, () =>
        transactionOf(hashOf("e", serial + 1), height)
      ),
    };

    blocks.set(height, block);

    return block;
  }

  for (let h = tip - 300; h <= tip; h += 1) {
    makeBlock(h, transactions.includes(h) ? 1 : 0);
  }

  for (const { received, sent } of history.values()) {
    [...sent, ...received]
      .filter((entry) => !txs.has(entry.origin))
      .forEach((entry) => transactionOf(entry.origin, entry.height));
  }

  return {
    blocks,
    makeBlock,
    top: () => Math.max(...blocks.keys()),
    txs,
  };
}

/** @param {FakeBlock} block */
const gqlBlock = (block) => ({
  fees: 0,
  gasSpent: 0,
  header: {
    gasLimit: 5_000_000_000,
    hash: block.hash,
    height: block.height,
    prevBlockHash: blockHash(block.height - 1),
    seed: hashOf("5", block.height),
    stateHash: hashOf("a", block.height),
    timestamp: block.timestamp,
    version: 0,
  },
  reward: 16_000_000_000,
  transactions: block.transactions,
});

/**
 * The node's GraphQL fields.
 *
 * @param {ReturnType<typeof createChain>} chain
 * @param {Map<string, Transfers>} history
 * @returns {Record<string, (field: Field) => any>}
 */
const answersOf = (chain, history) => ({
  block({ args, selection }) {
    const height =
      args.height === -1
        ? chain.top()
        : (args.height ??
          [...chain.blocks.values()].find((b) => b.hash === args.hash)?.height);
    const block = chain.blocks.get(height);

    if (!block) {
      return null;
    }

    return /transactions\s*\{\s*id\s*\}/.test(selection)
      ? {
          ...gqlBlock(block),
          transactions: block.transactions.map((t) => ({ id: t.id })),
        }
      : gqlBlock(block);
  },
  blocks({ args }) {
    const all = [...chain.blocks.values()];

    if (!args.range) {
      return all
        .sort((a, b) => b.height - a.height)
        .slice(0, args.last)
        .map(gqlBlock);
    }

    const [from, to] = args.range;

    return all
      .filter((b) => b.height >= from && b.height <= to)
      .sort((a, b) => a.height - b.height)
      .map(gqlBlock);
  },
  blockTxs({ args }) {
    const [from, to] = args.range;

    if (to - from + 1 > 200) {
      throw new Error("range too large (max 200 blocks)");
    }

    return [...chain.blocks.values()]
      .filter((b) => b.height >= from && b.height <= to)
      .sort((a, b) => a.height - b.height)
      .flatMap((b) => b.transactions);
  },
  fullMoonlightHistory({ args }) {
    const of = history.get(args.address);
    const all = of ? [...of.sent, ...of.received] : [];
    const unique = [...new Map(all.map((e) => [e.origin, e])).values()];

    return of
      ? {
          json: unique
            .sort((a, b) =>
              a.height === b.height
                ? a.origin.localeCompare(b.origin)
                : a.height - b.height
            )
            .map(asGroup),
        }
      : null;
  },
  mempoolTx: () => null,
  moonlightHistory({ args }) {
    const of = history.get(args.sender ?? args.receiver);

    return of ? pageOf(args.sender ? of.sent : of.received, args) : null;
  },
  transactions: ({ args }) =>
    [...chain.blocks.values()]
      .sort((a, b) => b.height - a.height)
      .flatMap((b) => b.transactions)
      .slice(0, args.last),
  tx: ({ args }) => chain.txs.get(args.hash) ?? null,
});

/**
 * One event frame: its headers' length, its headers, then its payload.
 *
 * @param {FakeBlock} block
 */
function frameOf(block) {
  const encoder = new TextEncoder();
  const headers = encoder.encode(
    JSON.stringify({
      "Content-Location": `/on/blocks:${block.hash}/accepted`,
      "Content-Type": "application/json",
    })
  );
  const payload = encoder.encode(
    JSON.stringify({
      header: {
        hash: block.hash,
        height: block.height,
        // eslint-disable-next-line camelcase
        prev_block_hash: blockHash(block.height - 1),
        timestamp: block.timestamp,
      },
      transactions: block.transactions.map((t) => t.id),
    })
  );
  const frame = new Uint8Array(4 + headers.length + payload.length);

  new DataView(frame.buffer).setUint32(0, headers.length, true);
  frame.set(headers, 4);
  frame.set(payload, 4 + headers.length);

  return frame.buffer;
}

/**
 * The node's websocket: each socket a session, which the node names first,
 * and the sessions subscribed to accepted blocks.
 *
 * @param {Logged[]} log
 */
function createSockets(log) {
  /** @type {Set<FakeSocket>} */
  const sockets = new Set();
  /** @type {Set<string>} */
  const subscribed = new Set();
  let sessions = 0;

  class FakeSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    binaryType = "blob";
    readyState = 0;
    session = hashOf("c", (sessions += 1)).slice(-32);

    /** @param {string | URL} url */
    constructor(url) {
      super();
      this.url = String(url);
      log.push({
        body: "",
        fields: [],
        headers: {},
        method: "WS",
        path: new URL(this.url).pathname,
        url: this.url,
      });
      sockets.add(this);
      setTimeout(() => this.open(), 0);
    }

    open() {
      if (this.readyState === 0) {
        this.readyState = 1;
        this.dispatchEvent(new Event("open"));
        this.dispatchEvent(new MessageEvent("message", { data: this.session }));
      }
    }

    close() {
      this.readyState = 3;
      sockets.delete(this);
      subscribed.delete(this.session);
    }

    /** As the node does, from its side. */
    drop() {
      this.close();
      this.dispatchEvent(new Event("close"));
    }

    send() {}
  }

  return {
    /** @param {FakeBlock} block */
    announce(block) {
      for (const socket of sockets) {
        if (subscribed.has(socket.session)) {
          socket.dispatchEvent(
            new MessageEvent("message", { data: frameOf(block) })
          );
        }
      }
    },
    FakeSocket,
    sockets,
    subscribed,
  };
}

/**
 * The node's HTTP endpoints, by path.
 *
 * @param {{ answers: Record<string, (field: Field) => any>, chain: ReturnType<typeof createChain>, provisioners: any[], subscribed: Set<string> }} node
 * @returns {Record<string, (entry: Logged) => Response>}
 */
const routesOf = ({ answers, chain, provisioners, subscribed }) => ({
  "/on/blocks/accepted": ({ headers, method }) => {
    const session = headers["Rusk-Session-Id"];

    if (method !== "GET" || !session) {
      return new Response("", { status: 424 });
    }

    subscribed.add(session);

    return new Response("", { status: 200 });
  },
  "/on/contracts:0200000000000000000000000000000000000000000000000000000000000000/get_stake":
    () => new Response("null"),
  "/on/graphql/query": (entry) => {
    const fields = fieldsOf(withVariables(entry.body, entry.headers));

    entry.fields = fields.map((f) => f.name);

    try {
      return Response.json(
        Object.fromEntries(fields.map((f) => [f.alias, answers[f.name](f)]))
      );
    } catch (error) {
      return new Response(String(error), { status: 500 });
    }
  },
  "/on/network/peers_location": () => Response.json(apiNodeLocations),
  "/on/node/info": () => Response.json(apiNodeInfo),
  "/on/node/provisioners": () => Response.json(provisioners),
  "/on/stats/tx_count": () =>
    Response.json({
      public: chain.txs.size,
      shielded: 0,
      total: chain.txs.size,
    }),
});

/**
 * Where a request outside the node's own paths goes.
 *
 * @param {URL} url
 */
function elsewhere(url) {
  if (url.host === "api.coingecko.com") {
    return Response.json(apiMarketData);
  }

  if (url.host === "supply.dusk.network") {
    return new Response("500000000");
  }

  return /^\/on\/account:\w+\/status$/.test(url.pathname)
    ? Response.json({ balance: 1_000_000_000, nonce: 1 })
    : new Response("", { status: 404 });
}

/**
 * @param {{
 *   behind?: number,
 *   history?: Map<string, Transfers>,
 *   provisioners?: any[],
 *   tip?: number,
 *   transactions?: number[],
 * }} [options] `transactions`: the heights of the blocks with a
 *   transaction, up to the tip; `behind`: how far the node's clock is
 *   behind the page's, in milliseconds. The blocks up to the tip came
 *   every ten seconds, the tip now.
 */
export function createFakeNode({
  behind = 0,
  history = new Map(),
  provisioners = hostProvisioners,
  tip = 1_000_000,
  transactions = [],
} = {}) {
  /** @type {Logged[]} */
  const log = [];
  const chain = createChain({ behind, history, tip, transactions });
  const ws = createSockets(log);
  const routes = routesOf({
    answers: answersOf(chain, history),
    chain,
    provisioners,
    subscribed: ws.subscribed,
  });

  return {
    /**
     * @param {string | URL | Request} input
     * @param {RequestInit} [init]
     */
    async fetch(input, init = {}) {
      const url = new URL(String(input instanceof Request ? input.url : input));
      /** @type {Logged} */
      const entry = {
        body: typeof init.body === "string" ? init.body : "",
        fields: [],
        headers: { .../** @type {Record<string, string>} */ (init.headers) },
        method: init.method ?? "GET",
        path: url.pathname,
        url: url.href,
      };

      log.push(entry);

      return routes[url.pathname]?.(entry) ?? elsewhere(url);
    },
    log,

    /**
     * The next block, with `count` transactions, announced to every
     * session subscribed.
     *
     * @param {number} [count]
     */
    mine(count = 0) {
      const block = chain.makeBlock(chain.top() + 1, count);

      ws.announce(block);

      return block;
    },

    /**
     * The requests to an endpoint, or to GraphQL asking a field.
     *
     * @param {string} what
     */
    requests: (what) =>
      log.filter((l) =>
        what.startsWith("/") ? l.path === what : l.fields.includes(what)
      ),

    /** The node's sockets, as the explorer opened them. */
    sockets: ws.sockets,

    get tip() {
      return chain.top();
    },

    WebSocket: ws.FakeSocket,
  };
}
