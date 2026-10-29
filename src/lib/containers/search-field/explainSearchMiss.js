import { decodeBase58 } from "@dusk-network/networks/account";
import { asDuskName } from "@duskdomains/sdk/names";

/**
 * Why a search found nothing, in words for the person searching, and a
 * `.dusk` name to try when the query could be one. It reads nothing from
 * the node.
 *
 * @param {string} query
 * @returns {{ message: string, suggestion?: string }}
 */
function explainSearchMiss(query) {
  const text = query.trim();
  const isHex = /^[0-9a-f]+$/i.test(text);

  // An ID as wallets and lists shorten it: its start and end.
  if (/^[0-9a-f]{4,}(?:…|\.{2,3})[0-9a-f]{4,}$/i.test(text)) {
    return {
      message:
        "This is a shortened ID. Copy the whole ID, 64 characters, and search again.",
    };
  }

  if (/^\d+$/.test(text)) {
    return { message: "There is no block at this height." };
  }

  if (isHex && text.length === 64) {
    return { message: "No block or transaction has this ID." };
  }

  if (isHex && text.length >= 12) {
    return {
      message:
        "This looks like the start of an ID. Search with the whole ID, 64 characters.",
    };
  }

  if (decodeBase58(text)?.length === 64) {
    return {
      message:
        "This is a shielded address. Shielded balances and transfers are private, so the explorer can't show them.",
    };
  }

  const suggestion = asDuskName(text);

  if (suggestion) {
    return {
      message: "No account, block or transaction matches this.",
      suggestion,
    };
  }

  return {
    message:
      "Search by account address, block height or hash, transaction ID or .dusk name.",
  };
}

export default explainSearchMiss;
