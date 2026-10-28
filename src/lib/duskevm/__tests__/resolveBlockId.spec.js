import { describe, expect, it, vi } from "vitest";

import { resolveBlockId } from "../resolveBlockId";

describe("resolveBlockId", () => {
  const blockHash = "ab".repeat(32);

  it("returns native block hashes without a lookup", async () => {
    const getBlockHashByHeight = vi.fn();

    await expect(
      resolveBlockId(blockHash.toUpperCase(), getBlockHashByHeight)
    ).resolves.toBe(blockHash);
    expect(getBlockHashByHeight).not.toHaveBeenCalled();
  });

  it("resolves block heights through the Dusk node", async () => {
    const getBlockHashByHeight = vi.fn().mockResolvedValue(blockHash);

    await expect(resolveBlockId("6738", getBlockHashByHeight)).resolves.toBe(
      blockHash
    );
    expect(getBlockHashByHeight).toHaveBeenCalledWith(6738);
  });

  it("rejects malformed identifiers before lookup", async () => {
    const getBlockHashByHeight = vi.fn();

    await expect(
      resolveBlockId("0x1234", getBlockHashByHeight)
    ).rejects.toThrow("Invalid block identifier");
    expect(getBlockHashByHeight).not.toHaveBeenCalled();
  });

  it("rejects unsafe block heights", async () => {
    const getBlockHashByHeight = vi.fn();

    await expect(
      resolveBlockId("9007199254740992", getBlockHashByHeight)
    ).rejects.toThrow("Invalid block identifier");
    expect(getBlockHashByHeight).not.toHaveBeenCalled();
  });

  it("rejects missing blocks", async () => {
    const getBlockHashByHeight = vi.fn().mockResolvedValue("");

    await expect(resolveBlockId("6738", getBlockHashByHeight)).rejects.toThrow(
      "Dusk block not found"
    );
  });
});
