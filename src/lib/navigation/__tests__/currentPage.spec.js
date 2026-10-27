import { describe, expect, it } from "vitest";

import { currentPage } from "..";

describe("currentPage", () => {
  const links = ["/", "/blocks", "/transactions", "/provisioners"];

  it("should put a block's page under Blocks and a transaction's under Transactions", () => {
    expect(currentPage("/blocks/", links)).toBe("/blocks");
    expect(currentPage("/blocks/block/", links)).toBe("/blocks");
    expect(currentPage("/transactions/transaction/", links)).toBe(
      "/transactions"
    );
  });

  it("should mark the home page only on the home page", () => {
    expect(currentPage("/", links)).toBe("/");
    expect(currentPage("/accounts/", links)).toBeUndefined();
  });

  it("should leave out the base path the explorer is served from", () => {
    expect(currentPage("/explorer/", links, "/explorer")).toBe("/");
    expect(currentPage("/explorer/provisioners/", links, "/explorer")).toBe(
      "/provisioners"
    );
    expect(currentPage("/explorer/accounts/", links, "/explorer")).toBe(
      undefined
    );
  });

  it("should not take a page whose name starts the same for another", () => {
    expect(currentPage("/blocksmith/", links)).toBeUndefined();
  });
});
