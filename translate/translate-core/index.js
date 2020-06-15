const translateApi = require("./google-translate")
/**
 *
 * @param {*} map 需要翻译的对象
 * @param {*} fn 处理函数
 * @param {*} context 结果保存的引用对象
 * @param {*} target 目标语言
 */
function _chainPromise(map, fn, context, target, log, api) {
  return Object.keys(map).reduce((acc, cur) => {
    return acc.then(function () {
      return fn(map[cur], cur, target, context, log, api)
    })
  }, Promise.resolve())
}
/**
 *
 * @param {*} value 要翻译的值
 * @param {*} target 目标语言
 * @param {*} context 需要保存的对象引用
 */
function _translateValue(value, key, target, context, log, api) {
  return new Promise((resolve, reject) => {
    translateApi(value, target, api)
      .then((result) => {
        if (log) {
          console.log(`Text: ${value}`)
          console.log(`Result: ${result.result}\r\n`)
        }
        context[key] = result.result
        resolve()
      })
      .catch((e) => {
        reject(e)
      })
  })
}
/**
 *
 * @param {*} source 需要翻译额对象
 * @param {*} target 目标语言
 */
function translate({ source, target, log = false, api = "google" }) {
  const translateMap = {}
  return new Promise((resolve, reject) => {
    _chainPromise(source, _translateValue, translateMap, target, log, api)
      .then(() => {
        resolve(translateMap)
      })
      .catch((e) => {
        reject(e)
      })
  })
}

module.exports = {
  translateApi,
  translate,
}
