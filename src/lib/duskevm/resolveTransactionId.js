const nativeTransactionIdPattern = /^[0-9a-f]{64}$/i;
const canonicalTransactionHashPattern = /^0x[0-9a-f]{64}$/i;

/**
 * Resolve either a native Dusk transaction ID or an adapter-canonical hash to
 * the native transaction ID understood by the Dusk explorer.
 *
 * @param {string} value
 * @param {string} [adapterUrl]
 * @returns {Promise<string>}
 */
export const resolveTransactionId = async (
  value,
  adapterUrl = import.meta.env.VITE_DUSKEVM_ADAPTER_URL || "/duskevm-rpc"
) => {
  if (nativeTransactionIdPattern.test(value)) {
    return value.toLowerCase();
  }

  if (!canonicalTransactionHashPattern.test(value)) {
    throw new Error("Invalid transaction identifier");
  }

  if (!adapterUrl) {
    throw new Error("DuskEVM adapter URL is not configured");
  }

  const canonicalHash = `0x${value.slice(2).toLowerCase()}`;
  const response = await fetch(adapterUrl, {
    body: JSON.stringify({
      id: "dusk-explorer",
      jsonrpc: "2.0",
      method: "duskevm_getDuskTransactionIdByHash",
      params: [canonicalHash],
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`DuskEVM adapter request failed (${response.status})`);
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error(payload.error.message || "DuskEVM adapter request failed");
  }

  if (payload.result === null) {
    throw new Error("Dusk transaction not found");
  }

  if (
    typeof payload.result !== "string" ||
    !nativeTransactionIdPattern.test(payload.result)
  ) {
    throw new Error("DuskEVM adapter returned an invalid transaction ID");
  }

  return payload.result.toLowerCase();
};
