// The DuskEVM transaction that delivered a deposit to DuskEVM, found as the
// Dusk wallets look when DuskEVM's adapter can't say: DuskEVM's explorer
// (its Blockscout API, in @dusk-network/networks) lists the recipient's
// incoming calls, the L2 bridge's payments among them. It asks once, for the
// first page of those calls.
//
// The explorer sees this deposit alone, so it links a payment only when it
// is surely this deposit's: the only one of its amount within two minutes of
// its block, once those two minutes are over. Two or more could be another
// deposit's, and so could one alone before the time is up, when this
// deposit's own may yet come. None is linked then, nor when the page doesn't
// reach back that far.

import { networkOf } from "$lib/network";

/** DUSK has 9 decimals on Dusk and 18 on DuskEVM. */
const WEI_PER_LUX = 1_000_000_000n;

/**
 * How long either side of a deposit's block its payment is looked for:
 * DuskEVM pays a deposit within a minute, and its clock and Dusk's can
 * differ a little, as the wallets allow.
 */
const WINDOW_MS = 120_000;

const EVM_TX_HASH = /^0x[0-9a-f]{64}$/i;

/**
 * A Blockscout time ("2026-10-27T05:52:13.000000Z") in milliseconds.
 *
 * @param {unknown} text
 */
const timeOf = (text) =>
  Date.parse(String(text ?? "").replace(/(\.\d{3})\d+/, "$1"));

/**
 * The first page of an address's incoming calls, newest first, as
 * DuskEVM's explorer lists them, or `null` when it can't say.
 *
 * @param {string} api The explorer's Blockscout API
 * @param {string} address
 * @param {typeof fetch} fetchFn
 * @returns {Promise<{ calls: any[], more: boolean } | null>}
 */
async function incomingCalls(api, address, fetchFn) {
  const response = await fetchFn(
    `${api.replace(/\/+$/, "")}/addresses/${address.toLowerCase()}/internal-transactions?filter=to`,
    { headers: { Accept: "application/json" } }
  );

  /** @type {any} */
  const page = response.ok ? await response.json() : null;

  return page
    ? {
        calls: Array.isArray(page.items) ? page.items : [],
        more: !!page.next_page_params,
      }
    : null;
}

/**
 * Whether a page of calls reaches back to `since`: the last page does, and
 * one with a call from before.
 *
 * @param {{ calls: any[], more: boolean }} page
 * @param {number} since
 */
const reachesBack = ({ calls, more }, since) =>
  !more || calls.some((call) => timeOf(call?.timestamp) < since);

/**
 * The L2 bridge's payments of an amount among the calls, between two times,
 * those that failed too.
 *
 * @param {any[]} calls
 * @param {{ bridge: string, from: number, to: number, wei: string }} payment
 * @returns {any[]}
 */
const paymentsIn = (calls, { bridge, from, to, wei }) =>
  calls.filter(
    (call) =>
      String(call?.from?.hash ?? "").toLowerCase() === bridge &&
      String(call?.value ?? "") === wei &&
      EVM_TX_HASH.test(String(call?.transaction_hash ?? "")) &&
      timeOf(call?.timestamp) >= from &&
      timeOf(call?.timestamp) <= to
  );

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
  { fetch: fetchFn = globalThis.fetch, now = Date.now() } = {}
) {
  const duskEvm = networkOf(chainId)?.duskEvm;
  const at = tx.date.getTime();

  if (!duskEvm || tx.txerror || !tx.deposit || now < at + WINDOW_MS) {
    return null;
  }

  const page = await incomingCalls(
    duskEvm.blockscoutApiUrl,
    recipient,
    fetchFn
  );
  const payments =
    page && reachesBack(page, at - WINDOW_MS)
      ? paymentsIn(page.calls, {
          bridge: duskEvm.predeploys.l2StandardBridge.toLowerCase(),
          from: at - WINDOW_MS,
          to: at + WINDOW_MS,
          wei: String(BigInt(Math.trunc(tx.deposit)) * WEI_PER_LUX),
        })
      : [];

  return payments.length === 1 && payments[0].success !== false
    ? String(payments[0].transaction_hash).toLowerCase()
    : null;
}
