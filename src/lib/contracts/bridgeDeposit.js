// Who a deposit to DuskEVM pays, read from the call's arguments as the
// bridge encodes them, the way the Dusk wallet reads them (bridgeCalls.js):
// only a call to the bridge on its own network, whose arguments decode
// exactly and whose DUSK sent is the amount they name. Anything else stays
// undecoded. It reads nothing from the node.

import { DUSKEVM_BRIDGE_CONTRACTS, networkKeyOf } from "./knownContracts";

const DEPOSIT_FUNCTION = "depositETHToWithValue";

/** The arguments' root, at their end: u64 amount, [u8; 20] to, u32 min gas, Vec<u8> extra data. */
const DEPOSIT_ROOT = 40;

/** @param {string} base64 */
function fromBase64(base64) {
  try {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * @param {Uint8Array} bytes
 * @param {number} at
 * @param {number} length
 */
function uintLe(bytes, at, length) {
  let value = 0n;

  for (let i = length - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[at + i]);
  }

  return value;
}

/**
 * A deposit's amount and DuskEVM address, or `null` when the arguments
 * aren't the bridge's: the root at the end, aligned, and the extra data
 * before it.
 *
 * @param {Uint8Array} args
 * @returns {{ amount: bigint, to: Uint8Array } | null}
 */
function decodeDeposit(args) {
  const root = args.length - DEPOSIT_ROOT;

  if (root < 0 || root % 8 !== 0) {
    return null;
  }

  const view = new DataView(args.buffer, args.byteOffset, args.byteLength);
  const extraStart = root + 32 + view.getInt32(root + 32, true);
  const extraLength = view.getUint32(root + 36, true);

  if (extraStart < 0 || extraStart + extraLength > root) {
    return null;
  }

  return {
    amount: uintLe(args, root, 8),
    to: args.subarray(root + 8, root + 28),
  };
}

/**
 * The DuskEVM address a deposit to DuskEVM pays, with its checksum, or
 * `null` when the transaction isn't one the bridge's encoding vouches for.
 *
 * @param {Transaction} tx
 * @param {number | null | undefined} chainId The node's network
 * @returns {Promise<string | null>}
 */
export async function bridgeDepositRecipient(tx, chainId) {
  const network = networkKeyOf(chainId);
  const bridge = network ? DUSKEVM_BRIDGE_CONTRACTS[network] : undefined;
  /** @type {{ call?: { fn_args?: unknown } }} */
  const payload = /** @type {any} */ (tx.payload) ?? {};
  const fnArgs = payload.call?.fn_args;

  if (
    !bridge ||
    tx.contract !== bridge.bridge ||
    tx.method !== DEPOSIT_FUNCTION ||
    tx.amount ||
    typeof fnArgs !== "string"
  ) {
    return null;
  }

  const args = fromBase64(fnArgs);
  const deposit = args ? decodeDeposit(args) : null;

  if (!deposit || deposit.amount !== BigInt(Math.trunc(tx.deposit ?? 0))) {
    return null;
  }

  const { checksumEthereumAddress } =
    await import("@duskdomains/sdk/chain-addresses");
  const hex = Array.from(deposit.to, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return checksumEthereumAddress(`0x${hex}`);
}
