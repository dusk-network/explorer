/*
 * JSON as the node writes it, read without losing a digit: its u64s are
 * bare numbers, and a JavaScript number holds integers exactly only up to
 * 2^53. A reviver's source text would do it, but older browsers that the
 * build supports don't give it.
 */

/*
 * An escape, a quote or a number. JSON has escapes only in strings, so the
 * other quotes tell a number from digits in a string. No pattern takes a
 * whole string: one with millions of escapes overflows the engine's stack.
 */
const TOKEN = /\\.|"|-?\d[\d.eE+-]*/g;

/**
 * What marks a big integer while it is a string: made as the page loads,
 * so that nothing a node sends can begin with it.
 */
const MARK = `bigint-${Math.random().toString(36).slice(2)}:`;

const MARKED = new RegExp(`"${MARK}(-?\\d+)"`, "g");

/** @param {string} token */
const isPastSafe = (token) =>
  /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token));

/**
 * `JSON.parse`, but for an integer past 2^53, which is a bigint of every
 * digit written.
 *
 * @param {string} text
 * @returns {any}
 */
export function parseJson(text) {
  let inString = false;

  const marked = text.replace(TOKEN, (token) => {
    if (token === '"') {
      inString = !inString;
    }

    return !inString && isPastSafe(token) ? `"${MARK}${token}"` : token;
  });

  return JSON.parse(marked, (_, value) =>
    typeof value === "string" && value.startsWith(MARK)
      ? BigInt(value.slice(MARK.length))
      : value,
  );
}

/**
 * What `parseJson` read, as indented JSON to show: a bigint is a number
 * again, as the node wrote it.
 *
 * @param {unknown} value
 * @returns {string}
 */
export const formatJson = (value) =>
  JSON.stringify(
    value,
    (_, part) => (typeof part === "bigint" ? `${MARK}${part}` : part),
    2,
  ).replace(MARKED, "$1");
