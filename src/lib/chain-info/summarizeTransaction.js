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

  /** @type {TransactionParty | null} */
  const to = tx.to
    ? { address: tx.to, kind: "account" }
    : tx.contract
      ? { id: tx.contract, kind: "contract" }
      : isShielded
        ? { kind: "shielded" }
        : null;

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
