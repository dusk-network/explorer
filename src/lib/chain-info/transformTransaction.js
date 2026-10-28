import { unixTsToDate } from "$lib/dusk/date";

/** @type {(tx: GQLTransaction["tx"]) => string} */
const getTransactionMethod = (tx) =>
  tx.blobHashes && tx.blobHashes.length
    ? "blob"
    : tx.isDeploy
      ? "deploy"
      : (tx.callData?.fnName ?? "transfer");

/** @type {(v: GQLTransaction) => Transaction} */
const transformTransaction = (tx) => {
  const payloadString = tx.tx.json ?? "{}";
  const payload = JSON.parse(payloadString);

  return {
    amount: payload.value,
    blobHashes: tx.tx.blobHashes ?? [],
    blockhash: tx.blockHash,
    blockheight: tx.blockHeight,
    contract: tx.tx.callData?.contractId,
    date: unixTsToDate(tx.blockTimestamp),
    deposit: payload.deposit ?? 0,
    feepaid: tx.gasSpent * tx.tx.gasPrice,
    from: payload.sender,
    gaslimit: tx.tx.gasLimit,
    gasprice: tx.tx.gasPrice,
    gasspent: tx.gasSpent,
    memo: tx.tx.memo ?? "",
    method: getTransactionMethod(tx.tx),
    nonce: payload.nonce,
    payload,
    success: tx.err === null,
    to: payload.receiver,
    txerror: tx.err ?? "",
    txid: tx.id,
    txtype: tx.tx.txType,
  };
};

export default transformTransaction;
