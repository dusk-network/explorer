import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/svelte";

import { createFakeNode } from "$lib/mock-data/fakeNode";

import AccountPage from "../+page.svelte";

const { key } = vi.hoisted(() => ({
  key: "qxwSidLBa1rJ74ngfP4GUCaNsAYjMboDPHzbmiVEMmNNK26hVkYe8QccH6ipYdVRsUDnx9QS1KBeu8ZoMDFpXJJE6YCcHy2AykvJ7eEAGc7PGDgCZFV5YJBxzukADkQ2Bgr",
}));

vi.mock("$app/stores", async (importOriginal) => {
  const { readable } = await import("svelte/store");

  return {
    .../** @type {object} */ (await importOriginal()),
    page: readable({ url: new URL(`http://localhost/accounts/?key=${key}`) }),
  };
});

vi.mock("$lib/contracts", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getStakedDusk: vi.fn().mockResolvedValue(null),
}));

vi.mock("$lib/dusk-domains", async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getPrimaryName: vi.fn().mockResolvedValue(null),
  getPrimaryNames: vi.fn().mockResolvedValue(new Map()),
  getSearchedName: vi.fn().mockResolvedValue(null),
}));

/** @param {number} n */
const idOf = (n) => n.toString(16).padStart(64, "0");

describe("Account page, its transactions", () => {
  // 37 sent and 21 received over ten days, as user2's on testnet.
  const sent = Array.from({ length: 37 }, (_, n) => ({
    height: 4_650_000 + n * 2_300,
    origin: idOf(1_000 + n),
  }));
  const received = Array.from({ length: 21 }, (_, n) => ({
    height: 4_650_100 + n * 4_100,
    origin: idOf(2_000 + n),
  }));
  const newestFirst = [...sent, ...received]
    .sort((a, b) => b.height - a.height)
    .map((entry) => entry.origin);

  /** @type {ReturnType<typeof createFakeNode>} */
  let node;

  beforeEach(() => {
    node = createFakeNode({
      history: new Map([[key, { received, sent }]]),
      tip: 4_736_000,
    });
    vi.stubGlobal("fetch", node.fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    vi.doUnmock("$app/stores");
    vi.doUnmock("$lib/contracts");
    vi.doUnmock("$lib/dusk-domains");
  });

  /** The IDs of the transactions the node was asked for, request by request. */
  const asked = () =>
    node
      .requests("tx")
      .map((request) =>
        [...request.body.matchAll(/tx\(hash: "([0-9a-f]{64})"\)/g)].map(
          ([, id]) => id
        )
      );

  it("should read the account's transactions a page at a time, newest first, and the next page only when asked for more", async () => {
    const { container, getByRole } = render(AccountPage);
    const shown = () =>
      Array.from(
        container.querySelectorAll("tbody tr a[href*='transaction?id=']"),
        (a) =>
          new URL(
            String(a.getAttribute("href")),
            "http://localhost"
          ).searchParams.get("id")
      );

    await vi.waitFor(() => expect(shown()).toHaveLength(15));

    // One read of the history, and only the first page's transactions.
    expect(shown()).toStrictEqual(newestFirst.slice(0, 15));
    expect(node.requests("moonlightHistory")).toHaveLength(1);
    expect(node.requests("fullMoonlightHistory")).toHaveLength(0);
    expect(asked()).toStrictEqual([newestFirst.slice(0, 25)]);

    // Past the first page, the next one.
    await fireEvent.click(getByRole("button", { name: "Show more" }));
    await vi.waitFor(() => expect(shown()).toHaveLength(30));
    expect(asked()).toHaveLength(2);

    await fireEvent.click(getByRole("button", { name: "Show more" }));
    await vi.waitFor(() => expect(shown()).toHaveLength(45));
    await fireEvent.click(getByRole("button", { name: "Show more" }));
    await vi.waitFor(() => expect(shown()).toHaveLength(58));

    // All of them, newest first, each once, and how many once all are there.
    expect(shown()).toStrictEqual(newestFirst);
    expect(asked().flat()).toStrictEqual(newestFirst);
    expect(node.requests("moonlightHistory")).toHaveLength(1);
    expect(container.querySelector(".data-card__footer")).toHaveTextContent(
      "58 of 58"
    );
  });
});
