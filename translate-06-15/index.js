const klaw = require("klaw")
const path = require("path")
const fs = require("fs")
const recast = require("recast")
const { parse, print } = recast
const jsonic = require("jsonic")
const { filterJs, dirExists, getStat } = require("./translate-helper")
const { translate } = require("./translate-core/index")
const rimraf = require("rimraf")

// 需要翻译的语言以及翻译后生成的文件夹名
const pathMap = {
  en: "en-Us",
  ru: "ru-Ru",
  vi: "vi-Vi",
}

// 需要翻译的文件夹路径
const rootDir = path.resolve(__dirname, ".././", "locals")

let sourceMap = []

// 每次一处旧文件，重新创建新的文件
deleteOldDir()
  .then(() => {
    // 文件删除完成，开始翻译重建
    init()
  })
  .catch((e) => {
    throw e
  })

/**
 * 读取指定文件夹下的所有文件并过滤出js文件，保存路径和ast到集合中
 * 读取是个异步过程
 */
function init() {
  klaw(rootDir)
    .pipe(filterJs)
    .on("data", function (item) {
      const ast = parse(fs.readFileSync(item.path, "utf8"))
      sourceMap.push({
        path: item.path,
        ast,
      })
    })
    .on("end", () => {
      handleParseObject()
      console.log("translate is runing,dont close window......")
      sourceMap.forEach((item) => {
        Object.keys(pathMap).forEach((key) => {
          translateSource(item.path, item.code, key)
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
 * 处理翻译
 */
function translateSource(dir, source, lang) {
  translate(source, lang, false).then((result) => {
    let rewritPath = dir.replace(/zh/, pathMap[lang])
    let resultPath = path.parse(rewritPath).dir

    dirExists(resultPath).then(() => {
      fs.writeFileSync(
        rewritPath,
        `module.exports = ${JSON.stringify(result, null, 2)}`
      )
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
