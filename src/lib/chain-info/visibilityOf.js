/**
 * Who sees what of a transaction. A public one shows everything. A
 * shielded one hides its sender, receiver and amount, but not the contract
 * it calls or the DUSK it sends to it.
 *
 * @param {Transaction} transaction
 * @returns {{ isPublic: boolean, label: "Public" | "Shielded", seen: string }}
 */
function visibilityOf(transaction) {
  const isPublic = transaction.txtype.toLowerCase() === "moonlight";

  return {
    isPublic,
    label: isPublic ? "Public" : "Shielded",
    seen: isPublic
      ? "Sender, receiver and amount are visible to everyone"
      : !transaction.contract
        ? "Sender, receiver and amount are hidden"
        : transaction.deposit
          ? "Sender and value are hidden. The contract called and the DUSK sent to it are public"
          : "Sender and value are hidden. The contract called is public",
  };
}

export default visibilityOf;
