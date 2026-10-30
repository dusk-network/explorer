// The DuskEVM transaction that delivered a deposit to DuskEVM, as
// @dusk-network/app-core/bridge finds it on DuskEVM's explorer, which lists
// the recipient's incoming calls: it asks once, for the first page, and
// links a payment only when it is surely this deposit's. The package loads
// on a deposit's page only.

import { networkOf } from "$lib/network";

import { bridgeDepositOf } from "./bridgeDeposit";

/**
 * The hash of the DuskEVM transaction that paid a deposit to DuskEVM, or
 * `null` when DuskEVM's explorer doesn't show it, or not surely.
 *
 * @param {Transaction} tx A deposit to DuskEVM that went through
 * @param {string} recipient The DuskEVM address it pays
 * @param {number | null | undefined} chainId The node's network
 * @param {{ fetch?: typeof fetch, now?: number }} [options] `now` is the
 *   viewer's clock, in milliseconds
 * @returns {Promise<string | null>}
 */
export async function findDepositArrival(
  tx,
  recipient,
  chainId,
  { fetch, now } = {}
) {
  const network = networkOf(chainId);
  // Its amount as its call names it: past 2^53 LUX, a number has lost digits.
  const amount = bridgeDepositOf(tx, chainId)?.amountLux;

  if (!network || tx.txerror || !amount) {
    return null;
  }

  const { depositArrivals } = await import("@dusk-network/app-core/bridge");
  const { arrivals } = await depositArrivals({
    deposits: [
      {
        amount,
        at: tx.date.getTime(),
        hash: tx.txid,
        to: recipient,
      },
    ],
    fetch,
    maxPages: 1,
    network,
    now,
    via: "explorer",
    // However long ago it was sent.
    waitMs: Infinity,
  });
  const [arrival] = arrivals.values();

  return arrival?.state === "arrived" ? arrival.hash : null;
}
