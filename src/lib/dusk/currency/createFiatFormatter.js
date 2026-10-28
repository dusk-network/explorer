/**
 * Creates a locale aware formatter for fiat values shown beside DUSK
 * amounts: rounded to cents, and "< $0.01" for anything smaller.
 *
 * @param {String} locale A BCP 47 language tag
 * @param {String} currency An ISO 4217 currency
 * @returns {(value: number) => string}
 */
const createFiatFormatter = (locale, currency) => {
  const formatter = new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });
  const smallest = `< ${formatter.format(0.01)}`;

  return (value) =>
    value > 0 && value < 0.005 ? smallest : formatter.format(value);
};

export default createFiatFormatter;
