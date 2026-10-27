import summarizeTransaction from "./summarizeTransaction";

/**
 * Which way a transaction went for an account: out of it, into it, from it
 * back to itself, or neither, as when it only paid a contract another
 * account named.
 *
 * @param {Transaction} tx
 * @param {string | null | undefined} account
 * @returns {"in" | "out" | "self" | undefined}
 */
function directionOf(tx, account) {
  if (!account) {
    return undefined;
  }

  const { from, to } = summarizeTransaction(tx);
  const sender = from?.kind === "account" ? from.address : undefined;
  const receiver = to?.kind === "account" ? to.address : undefined;

  if (account === sender && account === receiver) {
    return "self";
  }

  if (account === sender) {
    return "out";
  }

  if (account === receiver) {
    return "in";
  }

  return undefined;
}

export default directionOf;

/**
 * The sign an amount takes on an account's page, as in the web wallet: a
 * plus for what came in, a minus for what went out, and none for what was
 * sent to the account itself, for nothing, or for a failure, which moved
 * nothing.
 *
 * @param {"in" | "out" | "self" | undefined} direction
 * @param {number} lux
 * @param {boolean} failed
 * @returns {"" | "+" | "−"}
 */
export const amountSign = (direction, lux, failed) =>
  failed || !lux
    ? ""
    : direction === "in"
      ? "+"
      : direction === "out"
        ? "−"
        : "";
