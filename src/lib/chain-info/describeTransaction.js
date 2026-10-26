import { formatDuskExact } from "$lib/dusk/currency";

import summarizeTransaction from "./summarizeTransaction";

/**
 * The sender, the amount and the receiver in words: what a shielded
 * transaction hides is said to be hidden.
 *
 * @param {ReturnType<typeof summarizeTransaction>} summary
 * @param {string | null} from
 * @param {string | null} to
 */
const wordsFor = (summary, from, to) => ({
  amount:
    summary.amount.kind === "shielded"
      ? "a hidden amount"
      : `${formatDuskExact(summary.amount.lux)} DUSK`,
  receiver: summary.to?.kind === "shielded" ? "a shielded account" : to,
  sender:
    summary.from?.kind === "shielded"
      ? "A shielded account"
      : (from ?? "Someone"),
});

/**
 * Who sent how much to whom, in one plain sentence, with the names a page
 * shows for the sender and the receiver: a `.dusk` name, a contract's name
 * or a short address. A deposit to DuskEVM goes to the DuskEVM address its
 * call names.
 *
 * @param {Transaction} tx
 * @param {{ duskEvm?: string | null, from: string | null, to: string | null }} names
 * @returns {string}
 */
function describeTransaction(tx, { duskEvm = null, from, to }) {
  const summary = summarizeTransaction(tx);
  const { amount, receiver, sender } = wordsFor(summary, from, to);

  if (tx.method === "deploy") {
    return `${sender} deployed a contract`;
  }

  if (duskEvm) {
    return `${sender} sent ${amount} to ${duskEvm} on DuskEVM`;
  }

  if (
    summary.to?.kind === "contract" &&
    summary.amount.kind === "value" &&
    !summary.amount.lux
  ) {
    return `${sender} called ${tx.method} on ${receiver}`;
  }

  return receiver
    ? `${sender} sent ${amount} to ${receiver}`
    : `${sender} sent ${amount}`;
}

export default describeTransaction;
