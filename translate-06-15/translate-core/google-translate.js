const request = require("request-promise-native")
const key = "AIzaSyBin9npbZ7xErzRpvBG1yLcjn_CqWcRlXg"

const capitalize = require("./string.js").capitalize

function translate(text, target = "en") {
  return request({
    url: "https://translation.googleapis.com/language/translate/v2",
    qs: {
      q: text,
      target,
      key: key,
    },
  }).then(
    (result) => {
      result = JSON.parse(result).data.translations[0].translatedText

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

module.exports = translate
