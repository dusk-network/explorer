// Who a deposit to DuskEVM pays, read from the call's arguments as
// `@dusk-network/networks/duskevm` reads a bridge call: only a call to the
// bridge on its own network, whose arguments decode exactly and whose DUSK
// sent is the amount they name. Anything else stays undecoded. It reads
// nothing from the node.

import {
  bridgeEnvelopeOk,
  decodeBridgeCall,
} from "@dusk-network/networks/duskevm";

import { networkOf } from "$lib/network";

/** @param {string} base64 */
function fromBase64(base64) {
  try {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * The DuskEVM address a deposit to DuskEVM pays, with its checksum, or
 * `null` when the transaction isn't one the bridge's encoding vouches for.
 *
 * @param {Transaction} tx
 * @param {number | null | undefined} chainId The node's network
 * @returns {string | null}
 */
export function bridgeDepositRecipient(tx, chainId) {
  const network = networkOf(chainId);
  /** @type {{ call?: { fn_args?: unknown } }} */
  const payload = /** @type {any} */ (tx.payload) ?? {};
  const fnArgs = payload.call?.fn_args;
  const call =
    network && typeof fnArgs === "string"
      ? decodeBridgeCall(network, {
          args: fromBase64(fnArgs),
          contractId: tx.contract,
          fnName: tx.method,
        })
      : null;

  return call?.kind === "deposit" &&
    bridgeEnvelopeOk(call, { amount: tx.amount, deposit: tx.deposit })
    ? call.recipient
    : null;
}
