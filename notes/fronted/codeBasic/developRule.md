## 一、接口

* 接口报错的处理
* 接口无响应的处理
* 接口报会话过期的处理
* Get请求注意如果允许特殊符号一定要进行转译
* Get请求是有缓存的，需要特殊处理

## 二、界面

### `UI`

+ 内容溢出或者换行导致`UI`错乱

### Tips

* 各个组件间的关联关系一定要处理
* 每个业务操作之后的提示语一定是当前业务相关性的

### 提交按钮

* 防重复提交

### Input

* 去除首尾的空格
* 用户输入长度的限制
* 输入内容（数字、字母、符号）的限制
* 内容格式校验（Mac地址、http链接等）
* 输入异常提示和重置校验
* 内容是否能为空

### 表格

* 数据列为空的应该用特殊字符（`-`、空格）代替
* 列宽的设置，内容超出框的情况考虑（`...`,悬浮展示全部，提供按钮点击展示全部）
* 字典项展示的时候进行转译

### 文本

* 限制文本的长度，避免过长导致布局破坏

### 日期组件

* 开始日期必须大于结束日期

### 搜索组件

* 注意是否需要禁止特殊符号的输入
* 支持回车查询
* 重置时特殊字段需要特殊进行置空

### 文件上传组件

* 提示并限制上传文件的格式
* 上传文件大小限制
* 上传文件尺寸限制

### 富文本组件

* 具备删除格式功能

### 权限

+ 

## 三、[ES6编码风格](http://caibaojian.com/es6/style.html)

### 块级作用域

+ let取代var
+ let和`const`优先使用`const`

### 字符串

+ 静态字符串一律使用单引号或反引号，不使用双引号

### 解构赋值

+ 数组成员对变量赋值时，优先使用解构赋值

  ```javascript
  const [first, second] = arr;
  ```

  

+ 函数的参数如果是对象的成员，优先使用解构赋值

  ```javascript
  function getFullName({ firstName, lastName }) {
  }
  ```

+ 函数返回多个值，优先使用对象的解构赋值，而不是数组的解构赋值。这样便于以后添加返回值，以及更改返回值的顺序。

  ```javascript
  const { left, right } = processInput(input);
  ```

### 对象

+ 单行定义的对象，最后一个成员不以逗号结尾。

+ 多行定义的对象，最后一个成员以逗号结尾。

+ 对象尽量静态化，不得随意添加新的属性（特殊情况通过```Object.assign()```进行赋值）

+ 对象的属性名是动态的

  ```javascript
  const obj = {
    id: 5,
    name: 'San Francisco',
    [getKey('enabled')]: true,
  };
  ```

+ 对象的属性和方法尽量采用简洁表达式

  ```javascript
  const atom = {
    ref,
    value: 1,
    addValue(value) {
      return atom.value + value;
    },
  };
  ```

### 数组

+ 使用扩展运算符（...）拷贝数组

+ 使用```Array.form()```方法，将类似数组的对象转化为数组

  ```javascript
  const foo = document.querySelectorAll('.foo');
  const nodes = Array.from(foo);
  ```

### 函数

+ 立即执行函数可以写成箭头函数

  ```javascript
  (() => {
    console.log('Welcome to the Internet.');
  })();
  ```

+ 能使用尽量使用箭头函数

+ 箭头函数取代`Function.prototype.bind`，不应再用self/_this/that绑定 this。

  ```javascript
  // bad
  const self = this;
  const boundMethod = function(...params) {
    return method.apply(self, params);
  }
  
  // acceptable
  const boundMethod = method.bind(this);
  
  // best
  const boundMethod = (...params) => method.apply(this, params);
  ```

+ 所有配置项都应该集中在一个对象，放在最后一个参数，布尔值不可以直接作为参数。

  ```javascript
  // bad
  function divide(a, b, option = false ) {
  }
  
  // good
  function divide(a, b, { option = false } = {}) {
  }
  ```

+ 不要再函数内使用arguments变量，使用rest运算符（...）代替。原因是arguments是一个类似数组的对象，rest可以提供一个真正的数组

  ```javascript
  // bad
  function concatenateAll() {
    const args = Array.prototype.slice.call(arguments);
    return args.join('');
  }
  
  // good
  function concatenateAll(...args) {
    return args.join('');
  }
  ```

+ 使用默认值语法设置函数参数的默认值

  ```javascript
  // bad
  function handleThings(opts) {
    opts = opts || {};
  }
  
  // good
  function handleThings(opts = {}) {
    // ...
  }
  ```

### Map结构

+ 注意区分Map和Object。面向对象（映射现实世界）时才使用Object，如果只是为了使用`[key：value]`的数据结构，使用Map（因为Map有内置的遍历机制）。

  ```javascript
  let map = new Map(arr);
  
  for (let key of map.keys()) {
    console.log(key);
  }
  
  for (let value of map.values()) {
    console.log(value);
  }
  
  for (let item of map.entries()) {
    console.log(item[0], item[1]);
  }
  ```

### Class

+ 总是用Class，取代需要prototype的操作。因为Class的写法更简洁，更易于理解

  ```javascript
  // bad
  function Queue(contents = []) {
    this._queue = [...contents];
  }
  Queue.prototype.pop = function() {
    const value = this._queue[0];
    this._queue.splice(0, 1);
    return value;
  }
  
  // good
  class Queue {
    constructor(contents = []) {
      this._queue = [...contents];
    }
    pop() {
      const value = this._queue[0];
      this._queue.splice(0, 1);
      return value;
    }
  }
  ```

+ 使用`extends`实现继承，因为这样更简单，不会有破坏`instanceof`运算的危险。

  ```javascript
  // bad
  const inherits = require('inherits');
  function PeekableQueue(contents) {
    Queue.apply(this, contents);
  }
  inherits(PeekableQueue, Queue);
  PeekableQueue.prototype.peek = function() {
    return this._queue[0];
  }
  
  // good
  class PeekableQueue extends Queue {
    peek() {
      return this._queue[0];
    }
  }
  ```

### 模块

+ 使用`import`取代`require`

+ 使用`export`取代`module.exports`

+ 模块只有一个输出值，就使用`export default`

+ 模块有多个输出值，就不使用`export default`

+ 不要`export default`与普通的`export`同时使用

+ 不要在模块输入中使用通配符。因为这样可以确保你的模块之中，有一个默认输出（export default）

  ```javascript
  // bad
  import * as myObject './importModule';
  
  // good
  import myObject from './importModule';
  ```

+ 如果模块默认输出一个函数，函数名的首字母应该小写

  ```javascript
  function makeStyleGuide() {
  }
  
  export default makeStyleGuide;
  ```

+ 如果模块默认输出一个对象，对象名的首字母应该大写

  ```javascript
  const StyleGuide = {
    es6: {
    }
  };
  
  export default StyleGuide;
  ```

## 四、ESLint的使用

+ 安装`eslint`

  ```powershell
  npm i -g eslint
  ```

+ 配置`eslint`

  ```powershell
  # eslint 初始化生成.eslintrc.*的配置文件
  npx eslint --init
  ```

  ```javascript
  // http://eslint.org/docs/user-guide/configuring
  
  module.exports = {
      "env": {
          "browser": true,
          "es2021": true
      },
      "extends": [
          "airbnb-base"
      ],
      "parser": "@typescript-eslint/parser",
      "parserOptions": {
          "ecmaVersion": 12,
          "sourceType": "module"
      },
      "plugins": [
          "@typescript-eslint"
      ],
      "rules": {
      }
  };
  
  ```

+ 使用`eslint`

  - 单个文件

    ```powershell
    eslint index.js
    ```

  - 整个项目
    项目安装 `eslint`、`eslint-loader`依赖

+ VS支持`eslint`检测

  + 安装`eslint`依赖

  + 添加配置文件`.vscode/settings.json`

    ```json
    {
      "editor.formatOnPaste": true,
      "editor.formatOnType": false,
      "editor.formatOnSave": true,
      "eslint.format.enable": true,
      "editor.codeActionsOnSave": {
        "source.fixAll.eslint": false
      },
      "[javascript]": {
        "editor.defaultFormatter": "dbaeumer.vscode-eslint"
      },
      "[json]": {
        "editor.defaultFormatter": "dbaeumer.vscode-eslint"
      },
      "[vue]": {
        "editor.defaultFormatter": "octref.vetur"
      },
      "vetur.format.options.tabSize": 4,
      "vetur.format.scriptInitialIndent": false,
      "vetur.format.defaultFormatter.js": "vscode-typescript",
      "vetur.format.defaultFormatter.html": "js-beautify-html",
      "vetur.format.defaultFormatterOptions": {
        "prettier": {
          "semi": false,
          "singleQuote": true,
          "trailingComma": "none",
          "eslintIntegration": true
        },
        "js-beautify-html": {
          "wrap_attributes": "force-aligned"
        }
      },
      "javascript.format.insertSpaceBeforeFunctionParenthesis": true,
      "[html]": {
        "editor.defaultFormatter": "vscode.html-language-features"
      },
      "eslint.run": "onType",
      "eslint.validate": [
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "html",
        "vue",
        "markdown"
      ],
      "eslint.probe": [
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "html",
        "vue",
        "markdown"
      ]
    }
    ```
    
  + 【弃用】安装插件`perttier、eslint-plugin-prettier、eslint-config-prettier`, 并添加[配置文件`.prettierrc.js`](https://prettier.io/docs/en/options.html?spm=a2c4e.11153940.blogcont422690.11.5d0b5721zZ3CkZ)，并配置`.eslint.js`
  
    ```javascript
    // .prettierrc.js 文件
    module.exports = {
      semi: false,
      singleQuote: true,
      trailingComma: 'none',
      htmlWhitespaceSensitivity: 'ignore'
    }
    // .eslint.js 添加以下内容
    module.exports = {
        extends: ['prettier'],
      plugins: [prettier'],
        rules: {
            'prettier/prettier': [
                'error',
                {
                    htmlWhitespaceSensitivity: 'ignore'
                }
            ]
        }
    }
    
    
    ```
    
    

