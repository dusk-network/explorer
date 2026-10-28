import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import SearchPage from "../+page.svelte";

const { pages } = vi.hoisted(() => ({
  /** @type {{ at: (url: string) => void }} */
  pages: { at: () => {} },
}));

vi.mock("$app/stores", async (importOriginal) => {
  const { writable } = await import("svelte/store");
  const page = writable({ url: new URL("http://localhost/search/") });

  pages.at = (url) => page.set({ url: new URL(url) });

  return {
    .../** @type {object} */ (await importOriginal()),
    page: { subscribe: page.subscribe },
  };
});

describe("Search page", () => {
  afterEach(() => {
    cleanup();
    pages.at("http://localhost/search/");
  });

  afterAll(() => {
    vi.doUnmock("$app/stores");
  });

  it("should say it searches for the query in its address, while the search runs again", () => {
    pages.at("http://localhost/search/?q=zz-nobody-123.dusk");

    const { container } = render(SearchPage);

    expect(container.querySelector(".search-page")).toHaveTextContent(
      /^Searching…$/
    );
  });

  it("should say what can be searched when its address has no query", () => {
    const { container } = render(SearchPage);

    expect(container.querySelector(".search-page")).toHaveTextContent(
      "Search by account address, block height or hash, transaction ID or .dusk name."
    );
  });
});
