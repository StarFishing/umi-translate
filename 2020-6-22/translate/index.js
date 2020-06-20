const klaw = require("klaw");
const path = require("path");
const fs = require("fs");
const recast = require("recast");
const { parse, print } = recast;
const jsonic = require("jsonic");
const {
  filterJs,
  dirExists,
  getStat,
  removeComments,
} = require("./translate-helper");
const { translate } = require("./translate-core/index");
const rimraf = require("rimraf");
const through2 = require("through2");

// 需要翻译的语言以及翻译后生成的文件夹名
const pathMap = {
  en: "en-Us",
  ru: "ru-Ru",
  vi: "vi-Vi",
};

const baseDir = "zh-CN";

// 需要翻译的文件夹路径
const rootDir = path.resolve(__dirname, "../locales");

let sourceMap = [];
let translateErrorMap = [];

// 每次移除旧文件，重新创建新的文件
deleteOldDir()
  .then(() => {
    // 文件删除完成，开始翻译重建
    init();
  })
  .catch((e) => {
    console.error(e);
  });

/**
 * 读取指定文件夹下的所有文件并过滤出js文件，保存路径和ast到集合中
 * 读取是个异步过程
 */
function init() {
  klaw(path.join(rootDir, baseDir))
    .pipe(filterJs)
    .pipe(filterEntryIndex)
    .on("data", function (item) {
      const ast = parse(fs.readFileSync(item.path, "utf8"));
      sourceMap.push({
        path: item.path,
        ast,
        isEntry: path.basename(item.path, ".js") === "index",
      });
    })
    .on("end", () => {
      handleParseObject();
      console.log("translate is runing,dont close window......");
      handleStartTranslate();
      // sourceMap.forEach((item) => {
      //   Object.keys(pathMap).forEach((key) => {
      //     translateSource(item.path, replaceKeyByZero(item.code), key);
      //   });
      // });
    });
}

async function handleStartTranslate() {
  for (let i = 0; i < sourceMap.length; i++) {
    let item = sourceMap[i];
    await Object.keys(pathMap).reduce((acc, cur) => {
      return acc.then(() => {
        return translateSource(item.path, replaceKeyByZero(item.code), cur);
      });
    }, Promise.resolve());
  }
  if (translateErrorMap.length) {
    console.log(`翻译结束,存在部分文本翻译失败，错误收集如下`);
    console.log(translateErrorMap);
  } else console.log(`翻译结束,未发现文本翻译错误`);
}

/**
 * 将字符串astcode转换为对象
 */
function astCodeToObject(content) {
  return jsonic(content);
}

/**
 * 将ast获取的对象表达式字符串转换为js对象
 */
function getSourceObject(ast) {
  let codeObj;
  recast.visit(ast, {
    visitObjectExpression(path) {
      const astCode = print(path.node).code;
      // 移除注释后转换，否则无法解析注释
      codeObj = astCodeToObject(removeComments(astCode));
      return false;
    },
  });
  return codeObj || {};
}

/**
 * 批量处理读取的js文件
 */
function handleParseObject() {
  sourceMap = sourceMap.map((item) => {
    item.code = getSourceObject(item.ast);
    return item;
  });
  return sourceMap;
}

/**
 * 将翻译后的文件写回对应的文件夹下
 * @param {*} dir 目录名称
 * @param {*} lang 语言选型
 * @param {*} result 翻译结果（没有翻译的文件传空字符）
 * @param {*} ast ast结果
 */
function rewriteFolder(dir, lang, result, ast) {
  let rewritPath = dir.replace(baseDir, pathMap[lang]);
  let resultPath = path.parse(rewritPath).dir;
  let sourceCode;
  if (result) {
    sourceCode = `module.exports = ${JSON.stringify(result, null, 2)}`;
  } else {
    sourceCode = ast;
  }

  dirExists(resultPath).then(() => {
    fs.writeFileSync(rewritPath, sourceCode);
  });
}

/**
 * 处理翻译
 */
function translateSource(dir, source, lang) {
  return new Promise((resolve, reject) => {
    translate({ map: source, target: lang, log: true })
      .then((result) => {
        rewriteFolder(dir, lang, replaceZeroByKey(result, dir, lang));
        resolve();
      })
      .catch((e) => {
        console.log("Please check props type");
        reject(e);
      });
  });
}

/**
 * 删除存在的其他语言文件夹
 */
function deleteOldDir() {
  return Object.keys(pathMap).reduce((acc, cur) => {
    return acc.then(() => {
      const dir = path.join(rootDir, pathMap[cur]);

      return new Promise((resolve, reject) => {
        getStat(dir).then((status) => {
          if (status && status.isDirectory()) {
            rimraf(dir, (err) => {
              if (err) {
                console.log(err);
                console.error("文件夹移除失败");
                reject();
              }
              // 文件删除完成
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    });
  }, Promise.resolve());
}

/**
 * 过滤文件夹下index入口文件
 */
const filterEntryIndex = through2.obj(function (item, enc, callback) {
  if (path.basename(item.path, ".js") === "index") {
    Object.keys(pathMap).forEach((lang) => {
      const sourceFile = fs.readFileSync(item.path, "utf8");
      rewriteFolder(item.path, lang, false, sourceFile);
    });
  } else {
    this.push(item);
  }
  callback();
});

/**
 * 去除文本中的{key},避免翻译格式错误
 * @param {*} source
 */
function replaceKeyByZero(source) {
  const nokeySource = {};
  // transform {key}=>{0}
  Object.keys(source).forEach((key) => {
    nokeySource[key] = source[key].replace(/{key}/g, "{0}");
  });
  return nokeySource;
}
/**
 * 还原文本中的{key}
 * @param {*} source 翻译的结果对象
 * @param {*} dir 当前翻译文件的path
 */

function replaceZeroByKey(source, dir, lang) {
  const noZeroSource = {};
  let hasErrorText = false;
  // transform {0}=>{key}
  Object.keys(source).forEach((key) => {
    let result = source[key];
    // 收集翻译出错的文本
    if (result && result.code) {
      if (!hasErrorText) {
        translateErrorMap.push({
          path: dir,
          lang,
        });
      }
      hasErrorText = true;

      noZeroSource[key] = "Translate Error";
      translateErrorMap.push({
        [key]: result.text,
      });
    } else {
      noZeroSource[key] = source[key].replace(/{[0]*}/g, "{key}");
    }
  });
  return noZeroSource;
}
