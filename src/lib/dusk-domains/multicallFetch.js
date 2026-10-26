// Contract reads sent through Multicall for Dusk: a fetch for the Dusk Domains
// lens reader that puts the reads it makes in one task (`POST
// <node>/on/contracts:<id>/<fn>`) into one `aggregate` query, at most
// MAX_BATCH of them, and answers each read with its own result, as the node
// would have. The reader decodes and checks every reply as before; only the
// transport changes.
//
// As the SDK's own batcher (src/frozen/batching.ts in @duskdomains/sdk 0.5.4,
// MIT), which its full client uses: a read that ran out of its share of gas
// is sent alone, a query that failed whole sends its reads alone (two in a
// row turn batching off for 5 minutes), and a rate limit is every read's
// answer. Ported from the Dusk wallet extension's multicallFetch.js.

import {
  ARGBUF_LEN,
  MAX_CALLS,
  MULTICALL_CONTRACT_ID,
  callBytes,
  decodeAggregate,
  encodeAggregate,
  envelopeLength,
  replyLength,
} from "./vendor/duskdomains-multicall.js";

/**
 * @typedef {{
 *   init: RequestInit,
 *   reject: (reason?: unknown) => void,
 *   resolve: (response: Response) => void,
 * }} Waiter
 */

/**
 * @typedef {{
 *   args: Uint8Array,
 *   fn: string,
 *   gas: bigint,
 *   id: string,
 *   input: RequestInfo | URL,
 *   waiters: Waiter[],
 * }} Call
 */

/**
 * @typedef {{ Ok: Uint8Array }
 *   | { Err: "DoesNotExist" | "OutOfGas" | "Unknown" | { Panic: string } }} MulticallResult
 */

/**
 * Reads one aggregate carries. On testnet, 60 verified primary names (842M
 * gas cap each) passed in one; 32 stays well under the node's 3e9 query gas
 * bound and the 64 KiB reply.
 */
export const MAX_BATCH = 32;

/** Reply bytes a query is planned for, below the multicall's 65,536. */
const REPLY_BUDGET = 60_000;

/** A read's reply estimate before one was seen. */
const FIRST_REPLY = 2048;

const STREAK = 2;
const HOLDOFF_MS = 300_000;

/**
 * Runs a task after this one's microtasks, without the throttling a
 * background page puts on timers.
 *
 * @param {() => void} task
 */
function nextTask(task) {
  if (typeof MessageChannel === "function") {
    const channel = new MessageChannel();

    channel.port1.onmessage = () => {
      channel.port1.close();
      task();
    };
    channel.port2.postMessage(null);

    return;
  }

  setTimeout(task, 0);
}

/** @param {string} hex */
const hexToBytes = (hex) =>
  Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

/**
 * @param {BodyInit | null | undefined} body
 * @returns {Uint8Array | null}
 */
const bodyBytes = (body) => {
  if (body instanceof Uint8Array) {
    return new Uint8Array(body);
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body.slice(0));
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
    );
  }

  return null;
};

/** @param {Uint8Array} bytes */
const ok = (bytes) =>
  new Response(bytes.slice(), {
    headers: { "Content-Type": "application/octet-stream" },
    status: 200,
  });

/**
 * Gives every reader waiting on a read the same answer.
 *
 * @param {Call} call
 * @param {() => Response} response
 */
const answerAll = (call, response) => {
  for (const waiter of call.waiters) {
    waiter.resolve(response());
  }
};

/**
 * Whether a batch of `count` calls takes one more, the arguments and the
 * planned replies of all of them adding up to `data` and `reply` bytes.
 *
 * @param {number} count
 * @param {number} data
 * @param {number} reply
 * @param {number} cap
 */
const fits = (count, data, reply, cap) =>
  count < Math.min(cap, MAX_CALLS) &&
  envelopeLength(count + 1, data) <= ARGBUF_LEN &&
  replyLength(count + 1, reply) <= REPLY_BUDGET;

/** @param {Call[]} batch */
const encode = (batch) =>
  encodeAggregate(
    batch.map((c) => ({
      args: c.args,
      contract: hexToBytes(c.id),
      fnName: c.fn,
      gasLimit: c.gas,
    }))
  );

/**
 * Whether a reply is the node limiting its rate, as the SDK's readers take
 * it (`rateLimit` in its batching.ts): a 429, or a 503 that says when to
 * come back, in delay-seconds or as an HTTP date.
 *
 * @param {Response} res
 */
const isRateLimit = (res) => {
  if (res.status !== 503) {
    return res.status === 429;
  }

  const wait = res.headers.get("Retry-After")?.trim() ?? "";

  return (
    /^\d+$/.test(wait) ||
    (Number.isFinite(Date.parse(wait)) && /[a-z]/i.test(wait))
  );
};

/**
 * A signal for a request that answers several waiters: it aborts once each
 * of their own signals has, as nobody waits for the answer then. A waiter
 * without a signal keeps the request, and a signal two waiters share counts
 * once. `release` stops listening to theirs.
 *
 * @param {Waiter[]} waiters
 * @returns {{ release: () => void, signal: AbortSignal }}
 */
const whileAnyWaits = (waiters) => {
  const controller = new AbortController();
  const signals = waiters.map(({ init }) => init.signal);

  if (signals.some((signal) => !signal)) {
    return { release: () => {}, signal: controller.signal };
  }

  const waiting = new Set(signals);
  const onAbort = () => {
    for (const signal of waiting) {
      if (signal?.aborted) {
        waiting.delete(signal);
      }
    }

    if (!waiting.size) {
      controller.abort();
    }
  };

  for (const signal of waiting) {
    signal?.addEventListener("abort", onAbort);
  }

  onAbort();

  return {
    release: () => {
      for (const signal of signals) {
        signal?.removeEventListener("abort", onAbort);
      }
    },
    signal: controller.signal,
  };
};

/**
 * A rate limit is the node's answer to every read in the query.
 *
 * @param {Call[]} batch
 * @param {Response} res
 */
const rateLimited = (batch, res) => {
  const headers = { "Retry-After": res.headers.get("Retry-After") ?? "" };

  for (const call of batch) {
    answerAll(
      call,
      () => new Response("Rate limited", { headers, status: res.status })
    );
  }
};

/**
 * @param {{
 *   fetch?: typeof fetch,
 *   gasFor?: (contractId: string, fnName: string) => bigint,
 *   maxBatch?: number,
 *   nodeUrl: string,
 *   replyEstimate?: (contractId: string, fnName: string) => number | undefined,
 * }} options `fetch` sends everything else and the aggregates; `gasFor` is
 *   a read's gas cap inside an aggregate, 0n for a fair share of the query's;
 *   `replyEstimate` is the reply size a read is planned for until one is
 *   seen, 2 KiB if left out.
 * @returns {typeof fetch}
 */
export function createMulticallFetch({
  fetch: base = (...args) => fetch(...args),
  gasFor = () => 0n,
  maxBatch = MAX_BATCH,
  nodeUrl,
  replyEstimate = () => undefined,
}) {
  const prefix = `${String(nodeUrl).replace(/\/$/, "")}/on/contracts:`;

  /** The largest reply seen for each contract's function. @type {Map<string, number>} */
  const sizes = new Map();

  /**
   * The reads of this task, each once, and the batcher's state: failed
   * queries in a row, and until when batching is off.
   *
   * @type {{ offUntil: number, pending: Map<string, Call>, queue: Call[], scheduled: boolean, streak: number }}
   */
  const state = {
    offUntil: -Infinity,
    pending: new Map(),
    queue: [],
    scheduled: false,
    streak: 0,
  };

  /** @param {Call} call */
  const estimate = (call) =>
    sizes.get(`${call.id}/${call.fn}`) ??
    replyEstimate(call.id, call.fn) ??
    FIRST_REPLY;

  /**
   * One read sent on its own, its answer given to every waiter. A lone
   * waiter keeps its abort signal.
   *
   * @param {Call} call
   */
  const alone = (call) => {
    const watch = whileAnyWaits(call.waiters);

    base(call.input, { ...call.waiters[0].init, signal: watch.signal })
      .then(
        (res) => {
          const copies = call.waiters.map((_, i) =>
            i === call.waiters.length - 1 ? res : res.clone()
          );

          call.waiters.forEach((waiter, i) => waiter.resolve(copies[i]));
        },
        (error) => {
          for (const waiter of call.waiters) {
            waiter.reject(error);
          }
        }
      )
      .finally(watch.release);
  };

  /**
   * The reads in batches the multicall takes.
   *
   * @param {Call[]} calls
   * @returns {Call[][]}
   */
  const plan = (calls) => {
    /** @type {{ calls: Call[], data: number, reply: number }[]} */
    const batches = [];

    for (const call of calls) {
      const own = callBytes(call.fn, call.args);
      const planned = estimate(call);
      const last = batches.at(-1);

      if (
        last &&
        fits(last.calls.length, last.data + own, last.reply + planned, maxBatch)
      ) {
        last.calls.push(call);
        last.data += own;
        last.reply += planned;
      } else {
        batches.push({ calls: [call], data: own, reply: planned });
      }
    }

    return batches.map((batch) => batch.calls);
  };

  /**
   * A query that failed whole sends its reads alone; two in a row turn
   * batching off for a while.
   *
   * @param {Call[]} batch
   */
  const failed = (batch) => {
    strike();

    for (const call of batch) {
      alone(call);
    }
  };

  /** One more query that failed: two in a row turn batching off. */
  const strike = () => {
    if (++state.streak >= STREAK) {
      state.offUntil = Date.now() + HOLDOFF_MS;
      state.streak = 0;
    }
  };

  /**
   * Gives a read its result.
   *
   * @param {Call} call
   * @param {MulticallResult} result
   */
  const answer = (call, result) => {
    if ("Ok" in result) {
      learn(call, result.Ok.length);
      answerAll(call, () => ok(result.Ok));
    } else if (result.Err === "OutOfGas") {
      // Its share of the query's gas was short: a query of its own has it all.
      alone(call);
    } else {
      const message =
        typeof result.Err === "string" ? result.Err : result.Err.Panic;

      answerAll(call, () => new Response(message, { status: 500 }));
    }
  };

  /**
   * @param {Call} call
   * @param {number} length
   */
  const learn = (call, length) => {
    const key = `${call.id}/${call.fn}`;

    if (length > (sizes.get(key) ?? 0)) {
      sizes.set(key, length);
    }
  };

  /**
   * The aggregate's results, `null` when the query failed whole, or
   * `false` when the node rate-limited it.
   *
   * @param {Call[]} batch
   * @param {AbortSignal} signal
   * @returns {Promise<MulticallResult[] | null | false>}
   */
  const query = async (batch, signal) => {
    try {
      const res = await base(`${prefix}${MULTICALL_CONTRACT_ID}/aggregate`, {
        body: encode(batch),
        headers: {
          Accept: "application/octet-stream",
          "Content-Type": "application/octet-stream",
        },
        method: "POST",
        signal,
      });

      if (isRateLimit(res)) {
        rateLimited(batch, res);

        return false;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return /** @type {MulticallResult[]} */ (
        decodeAggregate(new Uint8Array(await res.arrayBuffer()), batch.length)
          .results
      );
    } catch {
      return null;
    }
  };

  /** @param {Call[]} batch */
  const send = async (batch) => {
    // A batch of one gains nothing from the multicall.
    if (batch.length === 1) {
      alone(batch[0]);

      return;
    }

    const watch = whileAnyWaits(batch.flatMap((call) => call.waiters));
    const results = await query(batch, watch.signal);

    watch.release();

    if (watch.signal.aborted) {
      // Every read gave up waiting on a query that hung: nobody needs its
      // reads sent again.
      strike();
    } else if (results === null) {
      failed(batch);
    } else if (results) {
      state.streak = 0;
      batch.forEach((call, i) => answer(call, results[i]));
    }
  };

  const flush = () => {
    const calls = state.queue;

    state.scheduled = false;
    state.queue = [];
    state.pending = new Map();

    for (const batch of plan(calls)) {
      void send(batch);
    }
  };

  /**
   * Queues a read for this task's queries: the same read twice in one task
   * is one call.
   *
   * @param {{ args: Uint8Array, fn: string, id: string, input: RequestInfo | URL }} read
   * @param {Waiter} waiter
   */
  const enqueue = ({ args, fn, id, input }, waiter) => {
    const key = `${id}/${fn}/${Array.from(args, (b) =>
      b.toString(16).padStart(2, "0")
    ).join("")}`;
    let call = state.pending.get(key);

    if (!call) {
      call = { args, fn, gas: gasFor(id, fn), id, input, waiters: [] };
      state.pending.set(key, call);
      state.queue.push(call);
    }

    call.waiters.push(waiter);

    if (!state.scheduled) {
      state.scheduled = true;
      nextTask(flush);
    }
  };

  /**
   * @param {RequestInfo | URL} input
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  return function multicallFetch(input, init = {}) {
    const url =
      input instanceof URL
        ? input.href
        : typeof input === "string"
          ? input
          : input.url;
    const match = url.startsWith(prefix)
      ? /^([0-9a-f]{64})\/([A-Za-z0-9_]+)$/.exec(url.slice(prefix.length))
      : null;
    const args = match ? bodyBytes(init.body) : null;

    if (
      !match ||
      !args ||
      match[1] === MULTICALL_CONTRACT_ID ||
      String(init.method).toUpperCase() !== "POST" ||
      Date.now() < state.offUntil
    ) {
      return base(input, init);
    }

    return new Promise((resolve, reject) => {
      const signal = init.signal;

      if (signal?.aborted) {
        reject(signal.reason);

        return;
      }

      signal?.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
      enqueue(
        { args, fn: match[2], id: match[1], input },
        { init, reject, resolve }
      );
    });
  };
}
