/**
 * @typedef {{ kind: "account", address: string }
 *   | { kind: "contract", id: string }
 *   | { kind: "shielded" }} TransactionParty
 */

/**
 * @typedef {{ kind: "value" | "deposit", lux: number }
 *   | { kind: "shielded" }} TransactionAmount
 */

/**
 * Where a transaction went. A call that sends no value went to its
 * contract, whatever receiver it names. The node leaves a public
 * transfer's receiver out when it is the sender, so a transfer with no
 * receiver went back to the sender, with or without a value. A value sent
 * along with a call goes to the receiver, or to the sender when none is
 * named.
 *
 * @param {Transaction} tx
 * @param {boolean} isShielded
 * @returns {TransactionParty | null}
 */
function receiverOf(tx, isShielded) {
  if (tx.contract && !tx.amount) {
    return { id: tx.contract, kind: "contract" };
  }

  if (tx.to) {
    return { address: tx.to, kind: "account" };
  }

  if (tx.from && (tx.amount || (!tx.contract && tx.method === "transfer"))) {
    return { address: tx.from, kind: "account" };
  }

  if (tx.contract) {
    return { id: tx.contract, kind: "contract" };
  }

  return isShielded ? { kind: "shielded" } : null;
}

/**
 * Who sent a transaction, where it went and how much DUSK it moved, as
 * the node's JSON shows it. A shielded transaction hides its sender,
 * receiver and value, but not the deposit it sends to a contract.
 *
 * The amount is the value sent to the receiver or, for a contract call,
 * the deposit sent to the contract.
 *
 * @param {Transaction} tx
 * @returns {{
 *   amount: TransactionAmount,
 *   from: TransactionParty | null,
 *   to: TransactionParty | null,
 * }}
 */
function summarizeTransaction(tx) {
  const isShielded = tx.txtype.toLowerCase() === "phoenix";

  /** @type {TransactionParty | null} */
  const from = tx.from
    ? { address: tx.from, kind: "account" }
    : isShielded
      ? { kind: "shielded" }
      : null;

  const to = receiverOf(tx, isShielded);

  /** @type {TransactionAmount} */
  const amount = tx.amount
    ? { kind: "value", lux: tx.amount }
    : tx.deposit
      ? { kind: "deposit", lux: tx.deposit }
      : isShielded
        ? { kind: "shielded" }
        : { kind: "value", lux: 0 };

  return { amount, from, to };
}

export default summarizeTransaction;
