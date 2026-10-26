import { hexToBytes, isValidHex } from "./";

const utf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * The text a hexadecimal string encodes, or `null` when its bytes are not
 * valid UTF-8 or hold control characters other than tabs and line breaks.
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

    // eslint-disable-next-line no-control-regex
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
      ? null
      : text;
  } catch {
    return null;
  }
}

export default hexToText;
