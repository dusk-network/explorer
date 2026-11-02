import { stakeCallOf } from "$lib/contracts/stakeCalls";
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
 * call names. A call to the stake contract says what it did in its type's
 * words: staked, unstaked or claimed rewards. One that failed moved
 * nothing: its sender only tried.
 *
 * @param {Transaction} tx
 * @param {{ duskEvm?: string | null, from: string | null, to: string | null }} names
 * @returns {string}
 */
function describeTransaction(tx, { duskEvm = null, from, to }) {
  const summary = summarizeTransaction(tx);
  const { amount, receiver, sender } = wordsFor(summary, from, to);
  const sent = tx.txerror ? "tried to send" : "sent";

  // Unless it sends DUSK on to an account as well.
  const stakeCall =
    summary.to?.kind === "contract"
      ? stakeCallOf(tx.contract, tx.method)
      : null;

  if (tx.method === "deploy") {
    return `${sender} deployed a contract`;
  }

  if (duskEvm) {
    return `${sender} ${sent} ${amount} to ${duskEvm} on DuskEVM`;
  }

  if (stakeCall) {
    const did = tx.txerror ? stakeCall.tried : stakeCall.done;

    return stakeCall.staked ? `${sender} ${did} ${amount}` : `${sender} ${did}`;
  }

  if (
    summary.to?.kind === "contract" &&
    summary.amount.kind === "value" &&
    !summary.amount.lux
  ) {
    return `${sender} called ${tx.method} on ${receiver}`;
  }

  return receiver
    ? `${sender} ${sent} ${amount} to ${receiver}`
    : `${sender} ${sent} ${amount}`;
}

export default describeTransaction;
