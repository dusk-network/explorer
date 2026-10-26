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
 * Where a transaction went. The node leaves a public transfer's receiver
 * out when it is the sender, so a public value with no receiver went back
 * to the sender; otherwise a call went to its contract.
 *
 * @param {Transaction} tx
 * @param {boolean} isShielded
 * @returns {TransactionParty | null}
 */
function receiverOf(tx, isShielded) {
  if (tx.to) {
    return { address: tx.to, kind: "account" };
  }

  if (tx.from && tx.amount) {
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
