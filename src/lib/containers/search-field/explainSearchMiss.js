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
      message: "Shortened ID: search with all 64 characters",
    };
  }

  if (/^\d+$/.test(text)) {
    return { message: "No block at this height yet" };
  }

  if (isHex && text.length === 64) {
    return { message: "No block or transaction with this ID" };
  }

  if (isHex && text.length >= 12) {
    return {
      message: "Partial ID: search with all 64 characters",
    };
  }

  if (decodeBase58(text)?.length === 64) {
    return {
      message: "Shielded address: private, not shown",
    };
  }

  const suggestion = asDuskName(text);

  if (suggestion) {
    return { message: "", suggestion };
  }

  return {
    message: "Try an account, block, transaction ID or .dusk name",
  };
}

export default explainSearchMiss;
