function unescape(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&#60;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#62;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ");
}

/**
 * 首字母大写
 * @param {*} value
 */
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = {
  unescape,
  capitalize,
};
