/** 侧边栏：由原 VuePress notes/.vuepress/sidebar 一比一转换而来 */
export default [
  {
    "label": "前端",
    "collapsed": true,
    "items": [
      {
        "label": "编码基础",
        "collapsed": true,
        "items": [
          {
            "label": "开发规范",
            "slug": "fronted/codeBasic/developRule"
          },
          {
            "label": "问题记录",
            "slug": "fronted/codeBasic/problemRecord"
          },
          {
            "label": "编写可读代码的艺术-阅读笔记",
            "slug": "fronted/codeBasic/codeArtReading"
          }
        ]
      },
      {
        "label": "兼容处理",
        "collapsed": true,
        "items": [
          {
            "label": "edge",
            "slug": "fronted/compatible/edge"
          },
          {
            "label": "ie",
            "slug": "fronted/compatible/ie"
          },
          {
            "label": "safari",
            "slug": "fronted/compatible/safari"
          }
        ]
      },
      {
        "label": "面试",
        "collapsed": true,
        "items": [
          {
            "label": "coding",
            "slug": "fronted/faceToFace/coding"
          },
          {
            "label": "实际面试",
            "slug": "fronted/faceToFace/actual_01"
          }
        ]
      },
      {
        "label": "即时通讯",
        "collapsed": true,
        "items": [
          {
            "label": "简介",
            "slug": "fronted/instantMessage/introduction"
          }
        ]
      },
      {
        "label": "关键字",
        "collapsed": true,
        "items": [
          {
            "label": "others",
            "slug": "fronted/keyword/others"
          },
          {
            "label": "npm依赖",
            "slug": "fronted/keyword/npmDependencies"
          },
          {
            "label": "webpack依赖",
            "slug": "fronted/keyword/webpackDependencies"
          }
        ]
      },
      {
        "label": "前端语言",
        "collapsed": true,
        "items": [
          {
            "label": "Css",
            "collapsed": true,
            "items": [
              {
                "label": "简介",
                "slug": "fronted/language/css/introduction"
              },
              {
                "label": "媒体选择器",
                "slug": "fronted/language/css/media"
              }
            ]
          },
          {
            "label": "Html",
            "collapsed": true,
            "items": [
              {
                "label": "H5标准",
                "slug": "fronted/language/html/h5_standard"
              }
            ]
          },
          {
            "label": "Deno",
            "collapsed": true,
            "items": [
              {
                "label": "简介",
                "slug": "fronted/language/deno/introduction"
              }
            ]
          },
          {
            "label": "Javascript",
            "collapsed": true,
            "items": [
              {
                "label": "基础",
                "slug": "fronted/language/javascript/basic"
              },
              {
                "label": "Ast",
                "slug": "fronted/language/javascript/ast"
              },
              {
                "label": "es6",
                "slug": "fronted/language/javascript/es6"
              },
              {
                "label": "eventLoop",
                "slug": "fronted/language/javascript/eventLoop"
              },
              {
                "label": "执行机制",
                "slug": "fronted/language/javascript/operatingMechanism"
              },
              {
                "label": "你不知道的Javascript - 阅读笔记",
                "collapsed": true,
                "items": [
                  {
                    "label": "作用域和闭包",
                    "slug": "fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01"
                  },
                  {
                    "label": "this和原型链",
                    "slug": "fronted/language/javascript/theJavaScriptYouDontKonw/thisAndPrototype_02"
                  }
                ]
              }
            ]
          },
          {
            "label": "Node",
            "collapsed": true,
            "items": [
              {
                "label": "简介",
                "slug": "fronted/language/node/introduction"
              },
              {
                "label": "node依赖包",
                "slug": "fronted/language/node/node_package"
              },
              {
                "label": "疑问",
                "slug": "fronted/language/node/problem"
              },
              {
                "label": "Typescript",
                "slug": "fronted/language/node/typescript"
              }
            ]
          },
          {
            "label": "React",
            "collapsed": true,
            "items": [
              {
                "label": "新建项目",
                "slug": "fronted/language/react/createProject"
              },
              {
                "label": "笔记",
                "slug": "fronted/language/react/notes"
              },
              {
                "label": "算法",
                "slug": "fronted/language/react/algorithm"
              },
              {
                "label": "redux",
                "slug": "fronted/language/react/redux"
              },
              {
                "label": "博客",
                "slug": "fronted/language/react/blog"
              }
            ]
          },
          {
            "label": "Typescript",
            "collapsed": true,
            "items": [
              {
                "label": "basic",
                "slug": "fronted/language/typescript/basic"
              }
            ]
          },
          {
            "label": "Vue",
            "collapsed": true,
            "items": [
              {
                "label": "新建项目",
                "slug": "fronted/language/vue/createProject"
              },
              {
                "label": "Vite",
                "collapsed": true,
                "items": [
                  {
                    "label": "简介",
                    "slug": "fronted/language/vue/vite/introduction"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "label": "移动端",
        "collapsed": true,
        "items": [
          {
            "label": "简介",
            "slug": "fronted/mobile/introduction"
          },
          {
            "label": "flutter",
            "collapsed": true,
            "items": [
              {
                "label": "环境搭建",
                "slug": "fronted/mobile/flutter/environment"
              },
              {
                "label": "实战",
                "slug": "fronted/mobile/flutter/practise"
              },
              {
                "label": "dart",
                "collapsed": true,
                "items": [
                  {
                    "label": "基础知识",
                    "slug": "fronted/mobile/flutter/dart/basic"
                  },
                  {
                    "label": "编码规则",
                    "slug": "fronted/mobile/flutter/dart/codeRule"
                  },
                  {
                    "label": "语法",
                    "slug": "fronted/mobile/flutter/dart/grammar"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "label": "项目优化",
        "collapsed": true,
        "items": [
          {
            "label": "简介",
            "slug": "fronted/optimization/introduction"
          },
          {
            "label": "关键字",
            "slug": "fronted/optimization/keyword"
          },
          {
            "label": "白屏",
            "collapsed": true,
            "items": [
              {
                "label": "背景",
                "slug": "fronted/optimization/blankScreen/background"
              },
              {
                "label": "方案",
                "slug": "fronted/optimization/blankScreen/case"
              }
            ]
          },
          {
            "label": "微前端",
            "collapsed": true,
            "items": [
              {
                "label": "什么是微前端",
                "slug": "fronted/optimization/microFronted/introduction"
              },
              {
                "label": "EMP微前端方案全面使用指南",
                "slug": "fronted/optimization/microFronted/practise"
              }
            ]
          }
        ]
      },
      {
        "label": "项目构建",
        "collapsed": true,
        "items": [
          {
            "label": "简介",
            "slug": "fronted/projectBuild/introduction"
          },
          {
            "label": "webpack",
            "collapsed": true,
            "items": [
              {
                "label": "背景",
                "slug": "fronted/projectBuild/webpack/background"
              },
              {
                "label": "概念",
                "slug": "fronted/projectBuild/webpack/concept"
              },
              {
                "label": "配置",
                "slug": "fronted/projectBuild/webpack/configuration"
              },
              {
                "label": "API",
                "slug": "fronted/projectBuild/webpack/api"
              },
              {
                "label": "错误",
                "slug": "fronted/projectBuild/webpack/error"
              },
              {
                "label": "vue项目",
                "slug": "fronted/projectBuild/webpack/vueProject"
              }
            ]
          },
          {
            "label": "postcss",
            "collapsed": true,
            "items": [
              {
                "label": "简介",
                "slug": "fronted/projectBuild/postcss/introduction"
              },
              {
                "label": "编译器",
                "slug": "fronted/projectBuild/postcss/translate"
              }
            ]
          },
          {
            "label": "rollup",
            "collapsed": true,
            "items": []
          }
        ]
      },
      {
        "label": "软件",
        "collapsed": true,
        "items": [
          {
            "label": "VSCode插件",
            "slug": "fronted/soft/vsCodePlugin"
          }
        ]
      },
      {
        "label": "测试相关",
        "collapsed": true,
        "items": [
          {
            "label": "karma",
            "slug": "fronted/test/karma"
          }
        ]
      }
    ]
  },
  {
    "label": "工作总结",
    "collapsed": true,
    "items": [
      {
        "label": "starlinke",
        "collapsed": true,
        "items": [
          {
            "label": "项目结构",
            "slug": "workSummary/starlinke/projectStructure"
          }
        ]
      },
      {
        "label": "一讯牵",
        "collapsed": true,
        "items": [
          {
            "label": "项目总结",
            "slug": "workSummary/yiXunQian/projectSummary"
          },
          {
            "label": "项目总结 - WifiPortal",
            "slug": "workSummary/yiXunQian/projectSummaryWifi"
          }
        ]
      }
    ]
  },
  {
    "label": "数据库",
    "collapsed": true,
    "items": [
      {
        "label": "mysql",
        "collapsed": true,
        "items": [
          {
            "label": "安装",
            "slug": "databases/mysql/install"
          }
        ]
      }
    ]
  },
  {
    "label": "系统",
    "collapsed": true,
    "items": [
      {
        "label": "linux",
        "collapsed": true,
        "items": [
          {
            "label": "基础",
            "slug": "system/linux/basic"
          },
          {
            "label": "软件",
            "slug": "system/linux/soft"
          },
          {
            "label": "vim",
            "slug": "system/linux/vim"
          }
        ]
      },
      {
        "label": "浏览器",
        "collapsed": true,
        "items": [
          {
            "label": "基础",
            "slug": "system/browser/basic"
          },
          {
            "label": "cookie",
            "slug": "system/browser/cookies"
          }
        ]
      }
    ]
  },
  {
    "label": "语言",
    "collapsed": true,
    "items": [
      {
        "label": "英文",
        "collapsed": true,
        "items": [
          {
            "label": "专业用词",
            "slug": "language/english/professional"
          }
        ]
      }
    ]
  }
]
