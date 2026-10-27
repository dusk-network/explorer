/**
 * Used to shorten a string by replacing the middle with an ellipsis.
 * @param {String} originalString
 * @param {Number} charactersToDisplay
 * @param {String} [ellipsis] What stands for the middle: three dots, or "…"
 *   where room is short.
 * @returns {String}
 */
function middleEllipsis(originalString, charactersToDisplay, ellipsis = "...") {
  if (originalString.length <= 2 * charactersToDisplay) {
    return originalString;
  }

  return `${originalString.substring(
    0,
    charactersToDisplay
  )}${ellipsis}${originalString.substring(originalString.length - charactersToDisplay)}`;
}

export default middleEllipsis;
