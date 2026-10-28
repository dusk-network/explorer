import { hexToBytes, isValidHex } from "./";

const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * Characters a memo could use to hide or reorder what it says: control
 * characters other than tabs and line breaks (C0 and C1), format characters
 * (bidi, zero-width, byte order mark) and line and paragraph separators.
 */
const HIDDEN = /(?![\t\n\r])[\p{Cc}\p{Cf}\u2028\u2029]/u;

/**
 * The text a hexadecimal string encodes, or `null` when its bytes are not
 * valid UTF-8 or hold control, bidirectional or zero-width characters.
 *
 * @param {string} value
 * @returns {string | null}
 */
function hexToText(value) {
  if (!value || !isValidHex(value)) {
    return null;
  }

  try {
    const text = utf8.decode(hexToBytes(value));

    return HIDDEN.test(text) ? null : text;
  } catch {
    return null;
  }
}

export default hexToText;
