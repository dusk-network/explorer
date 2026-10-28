import { describe, expect, it, vi } from "vitest";

import recorded from "./multicall-testnet.json";
import {
  decodeAggregate,
  encodeAggregate,
} from "../vendor/duskdomains-multicall.js";
import { MAX_BATCH, createMulticallFetch } from "../multicallFetch";
import { countCalls, aggregateReply as reply } from "./aggregateReply";

const NODE = "https://testnet.nodes.dusk.network";
const MULTICALL =
  "93de287b7d349d678a0038fe7772e8960e1a84a1b5da2d0b1f62f532616ce1d4";
const AGGREGATE = `${NODE}/on/contracts:${MULTICALL}/aggregate`;
const LENS = "7cb8b9dbd233657aa21d6dd77a4fb24261726d4a5a49d7ec8a246d8350cac913";

/** @param {string} hex */
const bytes = (hex) =>
  Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

/** @param {Uint8Array} u8 */
const hex = (u8) =>
  Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The lens reader's gas for a reverse read inside a multicall, as the
 * explorer gives it.
 *
 * @param {string} id
 * @param {string} fn
 */
const gasFor = (id, fn) =>
  id === LENS && fn === "reverse" ? 842_000_000n : 0n;

/**
 * A lens read as the reader's transport sends it.
 *
 * @param {string} fn
 * @param {number[]} [body]
 * @returns {[string, RequestInit]}
 */
const read = (fn, body = [1, 2, 3]) => [
  `${NODE}/on/contracts:${LENS}/${fn}`,
  { body: new Uint8Array(body), method: "POST" },
];

/**
 * A node that answers each request with `answer`.
 *
 * @param {(url: string, init: RequestInit) => Response} answer
 */
const node = (answer) =>
  vi.fn(
    /** @type {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} */ (
      async (input, init) => answer(String(input), init ?? {})
    )
  );

/** @param {Response} res */
const body = async (res) => hex(new Uint8Array(await res.arrayBuffer()));

describe("createMulticallFetch", () => {
  it("should send the lens reads of one task as the aggregate testnet answered, and give each read its own result", async () => {
    const base = node((url) => {
      expect(url).toBe(AGGREGATE);

      return new Response(bytes(recorded.aggregate.reply), {
        status: recorded.aggregate.status,
      });
    });
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const answers = await Promise.all(
      recorded.reads.map((r) =>
        fetch(`${NODE}${r.url}`, { body: bytes(r.body), method: "POST" })
      )
    );
    const { results } = decodeAggregate(
      bytes(recorded.aggregate.reply),
      recorded.reads.length
    );

    expect(base).toHaveBeenCalledTimes(1);
    // The envelope is byte for byte the one testnet answered.
    expect(hex(/** @type {Uint8Array} */ (base.mock.calls[0][1]?.body))).toBe(
      recorded.aggregate.envelope
    );

    for (const [i, res] of answers.entries()) {
      const result = results[i];

      expect(res.status).toBe(200);
      expect(await body(res)).toBe("Ok" in result ? hex(result.Ok) : "");
    }
  });

  it("should make one call of the same read twice", async () => {
    let calls = 0;
    const base = node((_, init) => {
      calls = countCalls(init.body);

      return new Response(reply([{ Ok: bytes("0a") }, { Ok: bytes("0b") }]));
    });
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const [a, b, again] = await Promise.all([
      fetch(...read("reverse", [1])),
      fetch(...read("reverse", [2])),
      fetch(...read("reverse", [1])),
    ]);

    expect(calls).toBe(2);
    expect(await body(a)).toBe("0a");
    expect(await body(again)).toBe("0a");
    expect(await body(b)).toBe("0b");
  });

  it("should send a read alone in its task as it is", async () => {
    const base = node(() => new Response(bytes("aa")));
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });

    await fetch(...read("binding"));

    expect(base).toHaveBeenCalledTimes(1);
    expect(base.mock.calls[0][0]).toBe(`${NODE}/on/contracts:${LENS}/binding`);
  });

  it("should send a read that ran out of its share of gas again alone", async () => {
    const base = node((url) =>
      url === AGGREGATE
        ? new Response(reply([{ Ok: bytes("01") }, { Err: "OutOfGas" }]))
        : new Response(bytes("02"))
    );
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const [first, second] = await Promise.all([
      fetch(...read("reverse", [1])),
      fetch(...read("reverse", [2])),
    ]);

    expect(await body(first)).toBe("01");
    expect(await body(second)).toBe("02");
    expect(base.mock.calls.map(([url]) => url)).toStrictEqual([
      AGGREGATE,
      `${NODE}/on/contracts:${LENS}/reverse`,
    ]);
    expect(
      Array.from(/** @type {Uint8Array} */ (base.mock.calls[1][1]?.body))
    ).toStrictEqual([2]);
  });

  it("should send the reads of a query that failed whole alone, and stop batching after two in a row", async () => {
    const base = node((url) =>
      url === AGGREGATE
        ? new Response("boom", { status: 500 })
        : new Response(bytes("aa"))
    );
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const pair = () =>
      Promise.all([
        fetch(...read("reverse", [1])),
        fetch(...read("reverse", [2])),
      ]);
    const aggregates = () =>
      base.mock.calls.filter(([url]) => url === AGGREGATE).length;

    for (const res of await pair()) {
      expect(res.status).toBe(200);
    }

    await pair();

    expect(aggregates()).toBe(2);

    await pair();

    // Held off: the third pair went straight to the node.
    expect(aggregates()).toBe(2);
    expect(base).toHaveBeenCalledTimes(8);
  });

  it("should give every read a rate limit's status and wait", async () => {
    const base = node(
      () =>
        new Response("slow down", {
          headers: { "Retry-After": "2" },
          status: 429,
        })
    );
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const answers = await Promise.all([
      fetch(...read("reverse", [1])),
      fetch(...read("reverse", [2])),
    ]);

    expect(
      answers.map((r) => [r.status, r.headers.get("Retry-After")])
    ).toStrictEqual([
      [429, "2"],
      [429, "2"],
    ]);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("should give every read the node's own clock with a Retry-After date", async () => {
    // A reader counts a date's wait from the reply's Date, not its own clock.
    const headers = {
      Date: "Mon, 26 Oct 2026 04:00:00 GMT",
      "Retry-After": "Mon, 26 Oct 2026 04:00:05 GMT",
    };
    const base = node(
      () => new Response("slow down", { headers, status: 503 })
    );
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const answers = await Promise.all([
      fetch(...read("reverse", [1])),
      fetch(...read("reverse", [2])),
    ]);

    for (const answer of answers) {
      expect(answer.status).toBe(503);
      expect(answer.headers.get("Date")).toBe(headers.Date);
      expect(answer.headers.get("Retry-After")).toBe(headers["Retry-After"]);
    }

    expect(base).toHaveBeenCalledTimes(1);
  });

  it("should send the reads alone after a 503 that says nothing of when to come back", async () => {
    const base = node((url) =>
      url === AGGREGATE
        ? new Response("unavailable", { status: 503 })
        : new Response(bytes("aa"))
    );
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const answers = await Promise.all([
      fetch(...read("reverse", [1])),
      fetch(...read("reverse", [2])),
    ]);

    expect(answers.map((r) => r.status)).toStrictEqual([200, 200]);
    expect(base.mock.calls.map(([url]) => url)).toStrictEqual([
      AGGREGATE,
      `${NODE}/on/contracts:${LENS}/reverse`,
      `${NODE}/on/contracts:${LENS}/reverse`,
    ]);
  });

  it("should give every read a 503's status when it says when to come back", async () => {
    const base = node(
      () =>
        new Response("busy", { headers: { "Retry-After": "3" }, status: 503 })
    );
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    const answers = await Promise.all([
      fetch(...read("reverse", [1])),
      fetch(...read("reverse", [2])),
    ]);

    expect(
      answers.map((r) => [r.status, r.headers.get("Retry-After")])
    ).toStrictEqual([
      [503, "3"],
      [503, "3"],
    ]);
    expect(base).toHaveBeenCalledTimes(1);
  });

  describe("Cancelling", () => {
    /**
     * A node that never answers: each request waits until its signal aborts.
     *
     * @returns {[import("vitest").Mock, AbortSignal[]]}
     */
    function hangingNode() {
      /** @type {AbortSignal[]} */
      const signals = [];
      const base = vi.fn(
        /** @type {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} */ (
          (_, init) =>
            new Promise((resolve, reject) => {
              const signal = /** @type {AbortSignal} */ (init?.signal);

              signals.push(signal);
              signal?.addEventListener("abort", () => reject(signal.reason));
            })
        )
      );

      return [base, signals];
    }

    /**
     * A read as the lens reader sends it, with a signal of its own.
     *
     * @param {number} arg
     */
    const abortable = (arg) => {
      const controller = new AbortController();
      const [url, init] = read("reverse", [arg]);

      return { controller, init: { ...init, signal: controller.signal }, url };
    };

    it("should cancel an aggregate once every read waiting on it has given up, and send nothing more", async () => {
      const [base, signals] = hangingNode();
      const fetch = createMulticallFetch({
        fetch: base,
        gasFor,
        nodeUrl: NODE,
      });
      const reads = [abortable(1), abortable(2)];
      const answers = reads.map(({ init, url }) =>
        fetch(url, init).catch((error) => error)
      );

      await vi.waitFor(() => expect(base).toHaveBeenCalledTimes(1));

      expect(signals[0]).toBeInstanceOf(AbortSignal);
      expect(signals[0].aborted).toBe(false);

      reads[0].controller.abort(new Error("timeout"));
      await Promise.resolve();

      // One read still waits.
      expect(signals[0].aborted).toBe(false);

      reads[1].controller.abort(new Error("timeout"));
      await Promise.all(answers);

      expect(signals[0].aborted).toBe(true);
      await new Promise((resolve) => setTimeout(resolve));
      expect(base).toHaveBeenCalledTimes(1);
    });

    it("should cancel a read sent alone for two waiters once both have given up", async () => {
      const [base, signals] = hangingNode();
      const fetch = createMulticallFetch({
        fetch: base,
        gasFor,
        nodeUrl: NODE,
      });
      const reads = [abortable(1), abortable(1)];
      const answers = reads.map(({ init, url }) =>
        fetch(url, init).catch((error) => error)
      );

      await vi.waitFor(() => expect(base).toHaveBeenCalledTimes(1));

      expect(base.mock.calls[0][0]).toBe(
        `${NODE}/on/contracts:${LENS}/reverse`
      );

      reads[0].controller.abort();
      await Promise.resolve();

      expect(signals[0].aborted).toBe(false);

      reads[1].controller.abort();
      await Promise.all(answers);

      expect(signals[0].aborted).toBe(true);
    });

    it("should cancel a read sent alone whose body stalls once its reader gives up", async () => {
      /** @type {AbortSignal[]} */
      const signals = [];
      // Headers at once, then a body that only ends when the request aborts.
      const base = vi.fn(
        /** @type {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} */ (
          async (_, init) => {
            const signal = /** @type {AbortSignal} */ (init?.signal);

            signals.push(signal);

            return new Response(
              new ReadableStream({
                start: (stream) =>
                  signal.addEventListener("abort", () =>
                    stream.error(signal.reason)
                  ),
              })
            );
          }
        )
      );
      const fetch = createMulticallFetch({
        fetch: base,
        gasFor,
        nodeUrl: NODE,
      });
      const { controller, init, url } = abortable(1);
      const reading = fetch(url, init)
        .then((res) => res.arrayBuffer())
        .catch((error) => error);

      await vi.waitFor(() => expect(base).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve));

      expect(signals[0].aborted).toBe(false);

      controller.abort(new Error("timeout"));

      await vi.waitFor(() => expect(signals[0].aborted).toBe(true));
      expect(await reading).toBeInstanceOf(Error);
    });

    it("should stop forwarding a reader's abort once it has read the body", async () => {
      /** @type {AbortSignal[]} */
      const signals = [];
      const base = vi.fn(
        /** @type {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} */ (
          async (_, init) => {
            signals.push(/** @type {AbortSignal} */ (init?.signal));

            return new Response(new Uint8Array([7, 8]));
          }
        )
      );
      const fetch = createMulticallFetch({
        fetch: base,
        gasFor,
        nodeUrl: NODE,
      });
      const reads = [abortable(1), abortable(1)];
      const answers = await Promise.all(
        reads.map(({ init, url }) => fetch(url, init))
      );

      expect(await Promise.all(answers.map(body))).toStrictEqual([
        "0708",
        "0708",
      ]);

      for (const { controller } of reads) {
        controller.abort();
      }

      expect(signals[0].aborted).toBe(false);
    });

    it("should keep an aggregate for reads that share one signal until it aborts", async () => {
      const [base, signals] = hangingNode();
      const fetch = createMulticallFetch({
        fetch: base,
        gasFor,
        nodeUrl: NODE,
      });
      // The reader's deployment check sends two reads with one signal.
      const controller = new AbortController();
      const answers = [read("binding"), read("lens_interface")].map(
        ([url, init]) =>
          fetch(url, { ...init, signal: controller.signal }).catch(
            (error) => error
          )
      );

      await vi.waitFor(() => expect(base).toHaveBeenCalledTimes(1));

      expect(signals[0].aborted).toBe(false);

      controller.abort();
      await Promise.all(answers);

      expect(signals[0].aborted).toBe(true);
    });
  });

  it(`should put at most ${MAX_BATCH} reads in one aggregate`, async () => {
    /** @type {number[]} */
    const sizes = [];
    const base = node((_, init) => {
      const n = countCalls(init.body);

      sizes.push(n);

      return new Response(
        reply(
          Array.from({ length: n }, (slot, i) => ({ Ok: new Uint8Array([i]) }))
        )
      );
    });
    const round = (/** @type {typeof globalThis.fetch} */ send) =>
      Promise.all(
        Array.from({ length: 70 }, (slot, i) =>
          send(...read("reverse", [i, i >> 8]))
        )
      );

    // Before it has seen a reply, a read is planned at 2 KiB, so the reply
    // fits its 64 KiB.
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });
    let answers = await round(fetch);

    expect(sizes).toStrictEqual([29, 29, 12]);
    expect(answers.every((r) => r.status === 200)).toBe(true);

    // With these small replies seen, the cap is the count.
    sizes.length = 0;
    answers = await round(fetch);

    expect(sizes).toStrictEqual([32, 32, 6]);
    expect(answers.every((r) => r.status === 200)).toBe(true);

    // Planned at the size the explorer gives a lens read, the cap binds at once.
    sizes.length = 0;
    await round(
      createMulticallFetch({
        fetch: base,
        gasFor,
        nodeUrl: NODE,
        replyEstimate: () => 1536,
      })
    );

    expect(sizes).toStrictEqual([32, 32, 6]);
  });

  it("should leave other requests alone", async () => {
    const base = node(() => new Response("{}"));
    const fetch = createMulticallFetch({ fetch: base, gasFor, nodeUrl: NODE });

    await Promise.all([
      fetch(`${NODE}/on/graphql/query`, {
        body: "query { x }",
        method: "POST",
      }),
      fetch("https://example.com/driver.wasm"),
      fetch(...read("reverse", [1])),
    ]);

    expect(base.mock.calls.map(([url]) => url)).toStrictEqual([
      `${NODE}/on/graphql/query`,
      "https://example.com/driver.wasm",
      `${NODE}/on/contracts:${LENS}/reverse`,
    ]);
  });
});

describe("the vendored codec", () => {
  it("should encode the envelope testnet answered", () => {
    // reverse, binding, lens_interface, reverse: the lens reader's reads.
    const calls = recorded.reads.map((r) => {
      const fn = /** @type {string} */ (r.url.split("/").pop());

      return {
        args: bytes(r.body),
        contract: bytes(LENS),
        fnName: fn,
        gasLimit: gasFor(LENS, fn),
      };
    });

    expect(hex(encodeAggregate(calls))).toBe(recorded.aggregate.envelope);
    expect(
      decodeAggregate(
        reply([{ Ok: bytes("beef") }, { Err: "OutOfGas" }], 9n),
        2
      )
    ).toStrictEqual({
      height: 9n,
      results: [{ Ok: bytes("beef") }, { Err: "OutOfGas" }],
    });
  });
});
