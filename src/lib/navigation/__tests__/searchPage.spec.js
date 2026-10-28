import { describe, expect, it } from "vitest";

import { searchPagePath, searchQueryOf } from "..";

describe("searchPagePath", () => {
  it("should give the search page's address for a query, the query encoded", () => {
    expect(searchPagePath("zz-nobody-123.dusk")).toBe(
      "/search/?q=zz-nobody-123.dusk"
    );
    expect(searchPagePath("a b&c")).toBe("/search/?q=a%20b%26c");
  });
});

describe("searchQueryOf", () => {
  // The tests' base path is "/some-base-path".
  it("should give the search page's query, trimmed", () => {
    expect(
      searchQueryOf(
        new URL("http://localhost/some-base-path/search/?q=%20bad_name%20")
      )
    ).toBe("bad_name");
    expect(
      searchQueryOf(new URL("http://localhost/some-base-path/search/"))
    ).toBe("");
  });

  it("should give nothing for any other page", () => {
    expect(
      searchQueryOf(new URL("http://localhost/some-base-path/accounts/?q=x"))
    ).toBeNull();
    expect(searchQueryOf(new URL("http://localhost/search/?q=x"))).toBeNull();
    expect(searchQueryOf(undefined)).toBeNull();
  });
});
