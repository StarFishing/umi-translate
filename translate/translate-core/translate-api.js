const request = require("request-promise-native");
const crypto = require("crypto");
const googleKey = "AIzaSyBin9npbZ7xErzRpvBG1yLcjn_CqWcRlXg";

const capitalize = require("./string.js").capitalize;
const appKey = "026c3150b6d41e86";
const youdaoKey = "Ssu0LY2aVlIzTajAH8TO2bF7F6eiXvkS";

/**
 *
 * @param {*} text 翻译文本
 * @param {*} target 目标语言
 * @param {*} api [google|youdao] api类型，接受字符串
 */
function translate(text, target = "en", api = "google") {
  const googleApi = {
    url: "https://translation.googleapis.com/language/translate/v2",
    qs: {
      q: text,
      target,
      key: googleKey,
    },
  };
  const youdaoApi = getYoudaoApi(text, target);
  const useGoogle = api === "google";
  return request(useGoogle ? googleApi : youdaoApi).then(
    (result) => {
      result = useGoogle
        ? JSON.parse(result).data.translations[0].translatedText
        : (JSON.parse(result).translation &&
            JSON.parse(result).translation[0]) || {
            code: 500,
            message: "翻译出错",
            text,
          };

      return {
        text: text,
        result: target === "en" ? !result.code && capitalize(result) : result,
      };
    },
    () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log("Connect Error,Please check network, Retrying....");
          resolve(translate(text, target));
        }, 1000);
      });
    }
  );
}

/**
 * 针对有道api的单词翻译长度限制
 * @param {*} q
 */
function truncate(q) {
  var len = q.length;
  if (len <= 20) return q;
  return q.substring(0, 10) + len + q.substring(len - 10, len);
}

/**
 * 拼接有道翻译api
 * @param {*} text 翻译文本
 * @param {*} target 目标语言
 * @param {*} from 当前语言
 */
function getYoudaoApi(text, target, from = "zh") {
  const salt = new Date().getTime();
  const curTime = Math.round(new Date().getTime() / 1000);
  const query = text;
  const to = target;
  const randomKey = appKey + truncate(query) + salt + curTime + youdaoKey;
  const hash = crypto.createHash("sha256");
  hash.update(randomKey);
  const sign = hash.digest("hex");
  return {
    url: "http://openapi.youdao.com/api",
    qs: {
      q: query,
      appKey: appKey,
      salt: salt,
      from: from,
      to: to,
      sign: sign,
      signType: "v3",
      curtime: curTime,
    },
  };
}

module.exports = translate;
