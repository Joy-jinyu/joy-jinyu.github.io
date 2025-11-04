### 安装依赖 

```json
{
  "name": "webpack project",
  "version": "1.2.0",
  "description": "1. node\r https://nodejs.org/dist/v6.6.0/node-v6.6.0-x64.msi\r 检查安装成功 =>\r node -v\r npm -v",
  "main": "gulpfile.js",
  "scripts": {
    "dev:webpack": "webpack --inline --progress --mode development"
  },
  "author": "joy",
  "license": "ISC",
  "devDependencies": {
    "vue": "^2.6.12",
    "vue-lazyload": "^1.3.3",
    "vue-loader": "^15.9.3",
    "vue-pickers": "^2.5.3",
    "vue-skeleton-component": "^1.1.2",
    "vue-template-compiler": "^2.6.12",
    "webpack": "^4.44.1",
    "webpack-cli": "^3.3.12",
    "webpack-dev-server": "^3.11.0",
    "webpack-glob-entry": "^2.1.1",
    "webpack-rtl-plugin": "^2.0.0",
    "mini-css-extract-plugin": "^0.11.3",
    "css-loader": "^4.3.0",
    "babel-loader": "^8.1.0",
    "style-loader": "^1.2.1",
    "url-loader": "^4.1.0",
    "less-loader": "^7.0.1"
  },
  "dependencies": {
    "rtlcss-webpack-plugin": "^4.0.6"
  },
  "repository": {
    "type": "git",
    "url": "1"
  },
  "keywords": [
    "fz"
  ]
}

```

### `webpack.conf.js`

```javascript
const path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const globEntry = require('webpack-glob-entry')
const RtlCssPlugin = require('rtlcss-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

function resolve(dir) {
    return path.join(__dirname, '..', dir)
}

const webpackconfig = {
    entry: globEntry('../vue-components/*.js'),
    output: {
        filename: 'js/[name].min.js',
        path: path.resolve(__dirname, '../../static/')
    },
    watch: process.env.NODE_ENV !== 'production'? true : false,
    watchOptions: {
        aggregateTimeout: 300,
        poll: 1000
    },
    externals: {
        Vue: 'Vue'
    },
    devServer:{
        contentBase:'./',
        hot: true,
    },
    resolve: {
        extensions: ['.js', '.vue', '.json'],
    },
    module:{
        rules:[
            {
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                include: [resolve('src'), resolve('test'), resolve('node_modules/webpack-dev-server/client')]
            },
            {
                test:/\.css$/,
                use: ['style-loader', "css-loader"]
            },{
                test:/\.less$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader
                    },
                    {
                        loader: 'css-loader'
                    },
                    {
                        loader: 'less-loader'
                    }
                ]
            },{
                test:/\.(png)|(jpg)|(gif)|(woff)|(svg)|(eot)|(ttf)$/,
                loader:'url-loader',
                options:{
                    limit:800000,
                    name:'[hash:8].[name].[ext]'
                }
            }

        ]
    },
    plugins:[
        new VueLoaderPlugin(),
        new MiniCssExtractPlugin({
            filename: "css/[name].css",
        }),
        new RtlCssPlugin('css-ar/[name].css')
    ]
}

module.exports = webpackconfig
```

### 项目源码

#### `recommend.vue`

```vue
<template>
</template>

<script>

export default {
    components: {
    },
    data () {
        return {
        }
    },
    methods: {
    },
    mounted () {
    }
}
</script>

<style lang="less" scoped>
</style>
```



#### `index.js`

```javascript
import recommend from './recommend'; // 推荐模块

// 兼容vue插件async加载
const tracker = setInterval(() => {
    if (window.Vue) {
        initVueComponent();
        clearInterval(tracker);
    }
}, 100);

// 实例化Vue组件
const initVueComponent = () => {
    // 商品历史浏览模块
    window.recommend = new Vue({
        render: h => h(recommend),
        methods: {
        },
        created () {
        }
    }).$mount("#recommend");
};

```

