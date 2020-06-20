const through2 = require("through2");
const path = require("path");
const fs = require("fs");

/**
 * 为klaw读取的item添加是否文件夹标识
 */
const filterFolder = through2.obj(function (item, enc, next) {
  // 添加文件夹标识
  item.isFolder = false;
  if (item.stats.isDirectory()) {
    item.isFolder = true;
  }
  this.push(item);
  next();
});

/**
 * 浅层过滤js文件
 * @param {*} item
 */
const filterJsFile = (item) => {
  // 这种方式无法过滤文件夹下的文件
  const extname = path.extname(item);
  return extname === ".js";
};

/**
 * 过滤所有js文件
 */
const filterJs = through2.obj(function (item, enc, next) {
  // 过滤所有js文件
  if (path.extname(item.path) === ".js") {
    this.push(item);
  }

  next();
});

/**
 * 判断文件||目录是否存在
 * @param {string} path 路径
 */
const getStat = (path) => {
  return new Promise((resolve) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        resolve(false);
      } else {
        resolve(stats);
      }
    });
  });
};

/**
 * 创建文件夹
 * @param {string} dir 路径
 */
const mkdir = (dir) => {
  return new Promise((resolve, reject) => {
    fs.mkdir(dir, (err) => {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

/**
 * 路径是否存在，不存在则创建
 * @param {string} dir 路径
 */
const dirExists = async (dir) => {
  let isExists = await getStat(dir);
  //如果该路径且不是文件，返回true
  if (isExists && isExists.isDirectory()) {
    return true;
  } else if (isExists) {
    //如果该路径存在但是文件，返回false
    return false;
  }
  //如果该路径不存在
  let tempDir = path.parse(dir).dir; //拿到上级路径
  //递归判断，如果上级目录也不存在，则会代码会在此处继续循环执行，直到目录存在
  let status = await dirExists(tempDir);
  let mkdirStatus;
  if (status) {
    mkdirStatus = await mkdir(dir);
  }
  return mkdirStatus;
};

/**
 * 移除读取到的对象表达式中的注释
 * @param {string} str
 * @return {string} 筛选后的字符串
 */
const removeComments = (str) => {
  let length = str.length;
  let indexline = -1;
  let indexbb = -1;
  let i = 0;

  while (i < length - 1) {
    let fi = str.charAt(i);
    let se = str.charAt(i + 1);
    if (fi == "/" && se == "/") {
      indexline = i;
      //删除直到\n
      while (i < length && str.charAt(i) != "\n") {
        i++;
      }
      str = str.substr(0, indexline) + str.substr(i + 1, length);
      length -= i - indexline;
      i = indexline - 1;
    } else if (fi == "/" && se == "*") {
      //找到下一个*/
      indexbb = i;
      i += 2;
      while (
        i < length - 1 &&
        !(str.charAt(i) == "*" && str.charAt(i + 1) == "/")
      )
        i++;
      str = str.substr(0, indexbb) + str.substr(i + 2, length);
      length -= i + 2 - indexbb;
      i = indexbb - 1;
    }
    i++;
  }
  return str;
};

module.exports = {
  filterFolder,
  filterJsFile,
  filterJs,
  dirExists,
  getStat,
  removeComments,
};
