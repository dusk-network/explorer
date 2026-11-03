import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { resolveTransactionId } from "../resolveTransactionId";

describe("resolveTransactionId", () => {
  const adapterUrl = "/duskevm-rpc";
  const canonicalHash = `0x${"AB".repeat(32)}`;
  const duskTransactionId = "cd".repeat(32);
  const fetchSpy = vi.spyOn(global, "fetch");

  afterEach(() => {
    fetchSpy.mockReset();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  it("returns native transaction IDs without calling the adapter", async () => {
    await expect(
      resolveTransactionId(duskTransactionId.toUpperCase())
    ).resolves.toBe(duskTransactionId);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves canonical hashes through the adapter", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "dusk-explorer",
          jsonrpc: "2.0",
          result: duskTransactionId.toUpperCase(),
        }),
        { status: 200 }
      )
    );

    await expect(resolveTransactionId(canonicalHash, adapterUrl)).resolves.toBe(
      duskTransactionId
    );
    expect(fetchSpy).toHaveBeenCalledWith(adapterUrl, {
      body: JSON.stringify({
        id: "dusk-explorer",
        jsonrpc: "2.0",
        method: "duskevm_getDuskTransactionIdByHash",
        params: [canonicalHash.toLowerCase()],
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("rejects malformed identifiers before calling the adapter", async () => {
    await expect(
      resolveTransactionId("not-a-hash", adapterUrl)
    ).rejects.toThrow("Invalid transaction identifier");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires an adapter URL for canonical hashes", async () => {
    await expect(resolveTransactionId(canonicalHash, "")).rejects.toThrow(
      "DuskEVM adapter URL is not configured"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects missing mappings", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "dusk-explorer",
          jsonrpc: "2.0",
          result: null,
        }),
        { status: 200 }
      )
    );

    await expect(
      resolveTransactionId(canonicalHash, adapterUrl)
    ).rejects.toThrow("Dusk transaction not found");
  });

  it("rejects adapter errors", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: -32000, message: "mapping unavailable" },
          id: "dusk-explorer",
          jsonrpc: "2.0",
        }),
        { status: 200 }
      )
    );

    await expect(
      resolveTransactionId(canonicalHash, adapterUrl)
    ).rejects.toThrow("mapping unavailable");
  });

  it("rejects malformed adapter results", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "dusk-explorer",
          jsonrpc: "2.0",
          result: "0x1234",
        }),
        { status: 200 }
      )
    );

    await expect(
      resolveTransactionId(canonicalHash, adapterUrl)
    ).rejects.toThrow("DuskEVM adapter returned an invalid transaction ID");
  });

  it("rejects failed HTTP requests", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(
      resolveTransactionId(canonicalHash, adapterUrl)
    ).rejects.toThrow("DuskEVM adapter request failed (503)");
  });
});
