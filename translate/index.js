const klaw = require("klaw")
const path = require("path")
const fs = require("fs")
const recast = require("recast")
const { parse, print } = recast
const jsonic = require("jsonic")
const {
  filterJs,
  dirExists,
  getStat,
  removeComments,
} = require("./translate-helper")
const { translate } = require("./translate-core/index")
const rimraf = require("rimraf")
const through2 = require("through2")

// 需要翻译的语言以及翻译后生成的文件夹名
const pathMap = {
  en: "en-Us",
  ru: "ru-Ru",
  vi: "vi-Vi",
}

const baseDir = "zh-CN"
// 需要翻译的文件夹路径
const rootDir = path.resolve(__dirname, "../locales")
const openLog = false // 是否开启翻译结果打印
const API = "youdao" //翻译api 可选值为 youdao || google
const async = false // 是否异步翻译 默认为true (同步翻译有较高的容错，但是时间较长)

// 以下配置不允许更改
let sourceMap = []
let translateErrorMap = []
let counter = 0 //全局计数器，在并发翻译时使用,不允许更改
let timeLabel = `采用${async ? "异步" : "同步"}翻译方式，翻译总用时`
// 每次移除旧文件，重新创建新的文件
deleteOldDir()
  .then(() => {
    // 文件删除完成，开始翻译重建
    init()
  })
  .catch((e) => {
    console.error(e)
  })

/**
 * 读取指定文件夹下的所有文件并过滤出js文件，保存路径和ast到集合中
 * 读取是个异步过程
 */
function init() {
  klaw(path.join(rootDir, baseDir))
    .pipe(filterJs)
    .pipe(filterEntryIndex)
    .on("data", function (item) {
      const ast = parse(fs.readFileSync(item.path, "utf8"))
      sourceMap.push({
        path: item.path,
        ast,
        isEntry: path.basename(item.path, ".js") === "index",
      })
    })
    .on("end", () => {
      handleParseObject()
      console.log("Translate is runing,don't close window......")
      console.time(timeLabel)
      if (async) {
        handleStartTranslate()
      } else {
        handleStartTranslateSync()
      }
    })
}

/**
 * 串行进行翻译，牺牲速度提高精度
 */
async function handleStartTranslateSync() {
  for (let i = 0; i < sourceMap.length; i++) {
    let item = sourceMap[i]
    await Object.keys(pathMap).reduce((acc, cur) => {
      return acc.then(() => {
        return translateSource(item.path, replaceKeyByZero(item.code), cur)
      })
    }, Promise.resolve())
  }
}

/**
 * 异步翻译
 */
function handleStartTranslate() {
  sourceMap.forEach((item) => {
    Object.keys(pathMap).forEach((key) => {
      translateSource(item.path, replaceKeyByZero(item.code), key)
    })
  })
}

/**
 * 将字符串astcode转换为对象
 */
function astCodeToObject(content) {
  return jsonic(content)
}

/**
 * 将ast获取的对象表达式字符串转换为js对象
 */
function getSourceObject(ast) {
  let codeObj
  recast.visit(ast, {
    visitObjectExpression(path) {
      const astCode = print(path.node).code
      // 移除注释后转换，否则无法解析注释
      codeObj = astCodeToObject(removeComments(astCode))
      return false
    },
  })
  return codeObj || {}
}

/**
 * 批量处理读取的js文件
 */
function handleParseObject() {
  sourceMap = sourceMap.map((item) => {
    item.code = getSourceObject(item.ast)
    return item
  })
  return sourceMap
}

/**
 * 将翻译后的文件写回对应的文件夹下
 * @param {*} dir 目录名称
 * @param {*} lang 语言选型
 * @param {*} result 翻译结果（没有翻译的文件传空字符）
 * @param {*} ast ast结果
 */
function rewriteFolder(dir, lang, result, ast) {
  let rewritPath = dir.replace(baseDir, pathMap[lang])
  let resultPath = path.parse(rewritPath).dir
  let sourceCode
  if (result) {
    sourceCode = `module.exports = ${JSON.stringify(result, null, 2)}`
  } else {
    sourceCode = ast
  }

  dirExists(resultPath).then(() => {
    fs.writeFileSync(rewritPath, sourceCode)
  })
}

/**
 * 处理翻译
 */
function translateSource(dir, source, lang) {
  return new Promise((resolve, reject) => {
    translate({ map: source, target: lang, log: openLog, api: API })
      .then((result) => {
        rewriteFolder(dir, lang, replaceZeroByKey(result, dir, lang))
        resolve()
      })
      .catch((e) => {
        console.log("Please check props type")
        reject(e)
      })
  })
}

/**
 * 删除存在的其他语言文件夹
 */
function deleteOldDir() {
  return Object.keys(pathMap).reduce((acc, cur) => {
    return acc.then(() => {
      const dir = path.join(rootDir, pathMap[cur])

      return new Promise((resolve, reject) => {
        getStat(dir).then((status) => {
          if (status && status.isDirectory()) {
            rimraf(dir, (err) => {
              if (err) {
                console.log(err)
                console.error("文件夹移除失败")
                reject()
              }
              // 文件删除完成
              resolve()
            })
          } else {
            resolve()
          }
        })
      })
    })
  }, Promise.resolve())
}

/**
 * 过滤文件夹下index入口文件
 */
const filterEntryIndex = through2.obj(function (item, enc, callback) {
  if (path.basename(item.path, ".js") === "index") {
    Object.keys(pathMap).forEach((lang) => {
      const sourceFile = fs.readFileSync(item.path, "utf8")
      rewriteFolder(item.path, lang, false, sourceFile)
    })
  } else {
    this.push(item)
  }
  callback()
})

/**
 * 去除文本中的{key},避免翻译格式错误
 * @param {*} source
 */
function replaceKeyByZero(source) {
  const nokeySource = {}
  // transform {key}=>{0}
  Object.keys(source).forEach((key) => {
    nokeySource[key] = source[key].replace(/{key}/g, "{0}")
  })
  return nokeySource
}

/**
 * 还原文本中的{key}
 * @param {object} source 翻译的结果对象
 * @param {string} dir 当前翻译文件的path
 * @param {string} lang 目标语言
 */

function replaceZeroByKey(source, dir, lang) {
  const noZeroSource = {}
  const Collect = new handleErrorTextCollect(dir, lang)
  // 全局计数器
  counter++
  logProgress(counter)
  // transform {0}=>{key}
  Object.keys(source).forEach((key) => {
    let result = source[key]
    // 收集翻译出错的文本
    if (result.code) {
      noZeroSource[key] = "Translate Error"
      Collect.append({
        [key]: result.text,
      })
    } else {
      try {
        noZeroSource[key] = result.replace(/{[0]*}/g, "{key}")
      } catch {
        // 处理翻译结果为非字符串情况
        noZeroSource[key] = result.toString()
      }
    }
  })

  appendTranslateErrorMap(Collect.getCollect())

  return noZeroSource
}

/**
 * 收集翻译错误日志
 * @param {string} path
 * @param {string} lang
 */
function handleErrorTextCollect(path, lang) {
  this.path = path
  this.lang = lang
  this.error = []
}
/**
 * 添加一条错误信息到错误实例
 * @param {object} obj
 */
handleErrorTextCollect.prototype.append = function (obj) {
  this.error.push(obj)
}
/**
 * 获取当前手机结果
 */
handleErrorTextCollect.prototype.getCollect = function () {
  return {
    path: this.path.replace(baseDir, pathMap[this.lang]),
    lang: this.lang,
    error: this.error,
  }
}

/**
 * 添加一个错误实例到错误日志
 * @param {object} errorMsg
 */
function appendTranslateErrorMap(errorMsg) {
  if (errorMsg.error.length) translateErrorMap.push(errorMsg)
  if (counter === sourceMap.length * Object.keys(pathMap).length) {
    logErrorInfo()
  }
}

/**
 * 错误日志打印
 */
function logErrorInfo() {
  console.timeEnd(timeLabel)
  if (translateErrorMap.length) {
    console.log(
      `翻译结束,存在部分文本翻译失败，错误收集如下，详情可查看当前目录下的 tranlate-error.json 文件`
    )
    console.table(translateErrorMap)
    fs.writeFileSync(
      path.resolve(__dirname, "tranlate-error.json"),
      JSON.stringify({ translateErrorMap }, null, 2)
    )
  } else console.log(`翻译结束,未发现文本翻译错误`)
}

/**
 * 翻译进度打印
 * @param {string} start
 */
function logProgress(start) {
  const total = sourceMap.length * Object.keys(pathMap).length
  const progress = Math.floor((start / total) * 100) / 100
  console.log(`当前进度${progress * 100}%`)
}
