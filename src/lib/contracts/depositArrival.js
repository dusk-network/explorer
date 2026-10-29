// The DuskEVM transaction that delivered a deposit to DuskEVM, found as the
// Dusk wallets find it when DuskEVM's adapter can't say: DuskEVM's explorer
// (its Blockscout API, in @dusk-network/networks) lists the recipient's
// incoming calls, and the L2 bridge's first payment of the deposit's amount
// from the deposit's block on is the one. It asks once, for the first page
// of those calls: a page that doesn't reach back to the deposit could miss
// its payment and hold another deposit's, so none is found then.

import { networkOf } from "$lib/network";

/** DUSK has 9 decimals on Dusk and 18 on DuskEVM. */
const WEI_PER_LUX = 1_000_000_000n;

/** Dusk's clock and DuskEVM's can differ a little, as the wallets allow. */
const CLOCK_SLACK_MS = 120_000;

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
 * The L2 bridge's first payment of an amount among the calls, from `since`
 * on.
 *
 * @param {any[]} calls
 * @param {{ bridge: string, since: number, wei: string }} payment
 * @returns {any}
 */
const firstPayment = (calls, { bridge, since, wei }) =>
  calls
    .filter(
      (call) =>
        call?.success !== false &&
        String(call?.from?.hash ?? "").toLowerCase() === bridge &&
        String(call?.value ?? "") === wei &&
        EVM_TX_HASH.test(String(call?.transaction_hash ?? "")) &&
        timeOf(call?.timestamp) >= since
    )
    .sort((a, b) => timeOf(a.timestamp) - timeOf(b.timestamp))[0];

/**
 * The hash of the DuskEVM transaction that paid a deposit to DuskEVM, or
 * `null` when DuskEVM's explorer doesn't show it yet, or can't say.
 *
 * @param {Transaction} tx A deposit to DuskEVM that went through
 * @param {string} recipient The DuskEVM address it pays
 * @param {number | null | undefined} chainId The node's network
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<string | null>}
 */
export async function findDepositArrival(
  tx,
  recipient,
  chainId,
  { fetch: fetchFn = globalThis.fetch } = {}
) {
  const duskEvm = networkOf(chainId)?.duskEvm;

  if (!duskEvm || tx.txerror || !tx.deposit) {
    return null;
  }

  const page = await incomingCalls(
    duskEvm.blockscoutApiUrl,
    recipient,
    fetchFn
  );
  const since = tx.date.getTime() - CLOCK_SLACK_MS;
  const paid =
    page && reachesBack(page, since)
      ? firstPayment(page.calls, {
          bridge: duskEvm.predeploys.l2StandardBridge.toLowerCase(),
          since,
          wei: String(BigInt(Math.trunc(tx.deposit)) * WEI_PER_LUX),
        })
      : null;

  return paid ? String(paid.transaction_hash).toLowerCase() : null;
}
