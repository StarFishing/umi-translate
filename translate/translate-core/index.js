const translateApi = require("./translate-api");
/**
 *链式调用翻译函数获取结果
 * @param {*} map 需要翻译的对象
 * @param {*} fn 处理函数
 * @param {*} context 结果保存的引用对象
 * @param {*} target 目标语言
 * @param {*} log 是否开启打印
 * @param {*} api 使用的api
 */
function _chainPromise(map, fn, context, target, log, api) {
  return Object.keys(map).reduce((acc, cur) => {
    return acc.then(function () {
      return fn(map[cur], cur, target, context, log, api);
    });
  }, Promise.resolve());
}

/**
 * 翻译文本
 * @param {*} value 翻译文本
 * @param {*} key 对象的键
 * @param {*} target 目标语言
 * @param {*} context 保存翻译结果的引用对象
 * @param {*} log 是否开启打印
 * @param {*} api 使用的api
 */
function _translateValue(value, key, target, context, log, api) {
  return new Promise((resolve, reject) => {
    translateApi(value, target, api)
      .then((result) => {
        const tResult = result.result;
        // 判断是否翻译出错
        const tValue = tResult && tResult.code ? "Translate Error" : tResult;
        if (log) {
          console.log(`Text: ${value}`);
          console.log(`Result: ${tValue}\r\n`);
        }
        context[key] = tResult;
        resolve();
      })
      .catch((e) => {
        reject(e);
      });
  });
}

/**
 * 获取整个对象的翻译结果
 * @param {*} param map：带翻译对象  target:目标语言  log:是否开启翻译结果打印  api:使用的翻译api 默认有道
 */
function translate({ map, target, log = false, api = "youdao" }) {
  const translateMap = {};
  return new Promise((resolve, reject) => {
    _chainPromise(map, _translateValue, translateMap, target, log, api)
      .then(() => {
        resolve(translateMap);
      })
      .catch((e) => {
        reject(e);
      });
  });
}

module.exports = {
  translateApi,
  translate,
};
