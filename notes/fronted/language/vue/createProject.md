### 创建项目

```shell
# vue-cli 是安装3以前的，3之后的通过@vue/cli安装
yarn global add @vue/cli
# 更新vue cli相关模块的（以 @vue/cli-plugin- 或 vue-cli-plugin- 开头），执行 vue upgrade
yarn global upgrade --latest @vue/cli

vue create romantic

# 进行选择
Vue CLI v4.5.13
? Please pick a preset: Manually select features
? Check the features needed for your project: Choose Vue version, Babel, TS, Router, Vuex, CSS Pre-processors, Linter, Unit, E2E

? Choose a version of Vue.js that you want to start the project with 3.x
? Use class-style component syntax? No
? Use Babel alongside TypeScript (required for modern mode, auto-detected polyfills, transpiling JSX)? Yes
? Use history mode for router? (Requires proper server setup for index fallback in production) Yes
? Pick a CSS pre-processor (PostCSS, Autoprefixer and CSS Modules are supported by default): Sass/SCSS (with node-sass)
? Pick a linter / formatter config: Airbnb
? Pick additional lint features: Lint on save
? Pick a unit testing solution: Mocha
? Pick an E2E testing solution: Cypress
? Where do you prefer placing config for Babel, ESLint, etc.? In package.json
? Save this as a preset for future projects? No
? Save preset as: romantic

# 支持jsx
yarn add -D @vue/babel-preset-jsx
yarn add -D @vue/babel-helper-vue-jsx-merge-props

```



### 小贴士

+ this.$data--当前状态下的data, this.$options.data--初始状态下的data

+ vue @provide @Inject 注入响应式数据

  tips: 共享的數據是響應式的話，綁定的數據一定得是個對象，（估計是對象的話，最終provide的是對象的對象指針）

