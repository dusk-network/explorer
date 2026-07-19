import { duskAPI } from "$lib/services";

const nativeBlockHashPattern = /^[0-9a-f]{64}$/i;
const blockHeightPattern = /^\d+$/;

/**
 * Resolve a native Dusk block hash or block height to the block hash used by
 * the explorer's block details page.
 *
 * @param {string} value
 * @param {(height: number) => Promise<string>} [getBlockHashByHeight]
 * @returns {Promise<string>}
 */
export const resolveBlockId = async (
  value,
  getBlockHashByHeight = duskAPI.getBlockHashByHeight
) => {
  if (nativeBlockHashPattern.test(value)) {
    return value.toLowerCase();
  }

  if (!blockHeightPattern.test(value)) {
    throw new Error("Invalid block identifier");
  }

  const height = Number(value);

  if (!Number.isSafeInteger(height)) {
    throw new Error("Invalid block identifier");
  }

  const blockHash = await getBlockHashByHeight(height);

  if (!nativeBlockHashPattern.test(blockHash)) {
    throw new Error("Dusk block not found");
  }

  return blockHash.toLowerCase();
};
