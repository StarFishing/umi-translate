const klaw = require("klaw")
const path = require("path")
const fs = require("fs")
const recast = require("recast")
const { parse, print } = recast
const jsonic = require("jsonic")
const { filterJs, dirExists, getStat } = require("./translate-helper")
const { translate } = require("./translate-core/index")
const rimraf = require("rimraf")
const through2 = require("through2")

// 需要翻译的语言以及翻译后生成的文件夹名
const pathMap = {
  en: "en-Us",
  ru: "ru-Ru",
  vi: "vi-Vi",
}

const baseDir = "zh"

// 需要翻译的文件夹路径
const rootDir = path.resolve(__dirname, "../locals")

let sourceMap = []

// 每次一处旧文件，重新创建新的文件
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
  klaw(path.join(rootDir))
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
      console.log("translate is runing,dont close window......")
      sourceMap.forEach((item) => {
        Object.keys(pathMap).forEach((key) => {
          translateSource(item.path, replaceKeyByZero(item.code), key)
        })
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
      codeObj = astCodeToObject(astCode)
      return false
    },
  })
  return codeObj
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
  translate({ source, target: lang, log: true })
    .then((result) => {
      rewriteFolder(dir, lang, replaceZeroByKey(result))
    })
    .catch((e) => {
      throw e
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
      // })
    })
  }, Promise.resolve())
}

/**
 * 过滤文件夹下index入口文件
 */
const filterEntryIndex = through2.obj(function (item, enc, callback) {
  if (path.basename(item.path, ".js") === "index") {
    Object.keys(pathMap).forEach((key) => {
      const ast = fs.readFileSync(item.path, "utf8")
      rewriteFolder(item.path, key, false, ast)
    })
  } else {
    this.push(item)
  }
  // this.push(chunk);
  callback()
})

/**
 * 去除文本中的{key},避免翻译格式错误
 * @param {*} source
 */

function replaceKeyByZero(source) {
  const nokeySource = {}
  Object.keys(source).forEach((key) => {
    nokeySource[key] = source[key].replace(/{key}/g, "{0}")
  })
  return nokeySource
}

/**
 * 还原文本中的{key}
 * @param {*} source
 */

function replaceZeroByKey(source) {
  const noZeroSource = {}
  Object.keys(source).forEach((key) => {
    noZeroSource[key] = source[key].replace(/{[0]*}/g, "{key}")
  })
  return noZeroSource
}
