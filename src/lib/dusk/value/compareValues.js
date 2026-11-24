/**
 * Orders two integers, smaller first, exactly: a number and a bigint
 * compare by their values. Subtracting would lose the difference between
 * two numbers past 2^53.
 *
 * @param {number | bigint} a
 * @param {number | bigint} b
 * @returns {number}
 */
const compareValues = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export default compareValues;
