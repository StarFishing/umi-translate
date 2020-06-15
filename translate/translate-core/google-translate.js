const request = require("request-promise-native")
const crypto = require("crypto")
const googleKey = "AIzaSyBin9npbZ7xErzRpvBG1yLcjn_CqWcRlXg" // 这里时你自己的Google注册的key

const capitalize = require("./string.js").capitalize
const appKey = "026c3150b6d41e86" // 这里存放你自己的appKey
const youdaoKey = "Ssu0LY2aVlIzTajAH8TO2bF7F6eiXvkS" // 这里时注册后获取的key

/**
 *
 * @param {*} text
 * @param {*} target
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
  }
  const youdaoApi = getYoudaoApi(text, target)
  const useGoogle = api === "google"
  return request(useGoogle ? googleApi : youdaoApi).then(
    (result) => {
      //   console.log(result);
      result = useGoogle
        ? JSON.parse(result).data.translations[0].translatedText
        : (JSON.parse(result).translation &&
            JSON.parse(result).translation[0]) ||
          "Translate Error"

      return {
        text: text,
        result: target === "en" ? capitalize(result) : result,
      }
    },
    () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log("Connect Error,Please check network, Retrying....")
          resolve(translate(text, target))
        }, 1000)
      })
    }
  )
}

function truncate(q) {
  var len = q.length
  if (len <= 20) return q
  return q.substring(0, 10) + len + q.substring(len - 10, len)
}

function getYoudaoApi(text, target, from = "zh") {
  const salt = new Date().getTime()
  const curTime = Math.round(new Date().getTime() / 1000)
  const query = text
  const to = target
  const randomKey = appKey + truncate(query) + salt + curTime + youdaoKey
  const hash = crypto.createHash("sha256")
  hash.update(randomKey)
  const sign = hash.digest("hex")
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
  }
}

module.exports = translate
