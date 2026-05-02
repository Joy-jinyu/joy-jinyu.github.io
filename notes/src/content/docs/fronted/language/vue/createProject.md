---
title: Vue 3 项目搭建
description: 用官方脚手架 create-vue 创建基于 Vite 的 Vue 3 项目，介绍目录结构、单文件组件、组合式 API 的最小示例，以及 Vue Router 和 Pinia 的接入要点。
---

这篇讲怎么起一个 Vue 3 项目。先说明 Vue CLI 的现状和为什么改用 create-vue，然后给出创建步骤、生成的目录结构、单文件组件和组合式 API 的最小示例，最后接入路由（Vue Router）和状态管理（Pinia）。读完可以得到一个结构清晰、能直接开发的项目，并知道各部分在做什么。

## 从 Vue CLI 到 create-vue

Vue CLI（`@vue/cli`）是早期的官方脚手架，基于 webpack，通过 `vue create` 创建项目，并通过 `@vue/cli-plugin-*` 插件体系扩展功能。它现在已进入维护模式，不再推荐用于新项目。

官方推荐的脚手架是 create-vue，它生成的是基于 Vite 的项目：

| | Vue CLI | create-vue |
| --- | --- | --- |
| 构建工具 | webpack | Vite |
| 开发服务器启动 | 需要先打包，项目越大越慢 | 基于原生 ESM 按需编译，启动快 |
| 配置方式 | `vue.config.js`，封装了 webpack 配置 | `vite.config.ts`，直接就是 Vite 配置 |
| 状态管理选项 | Vuex | Pinia |

旧项目从 Vue CLI 迁移时，主要工作是：把 `public/index.html` 移到根目录并引入入口脚本，把 `process.env.VUE_APP_*` 改成 `import.meta.env.VITE_*`，把 `require` 引用的资源改为 `import`，以及把 webpack 专用的配置和 loader 换成对应的 Vite 配置或插件。Vite 的原理和配置见 [Vite 原理与使用](/notes/fronted/language/vue/vite/introduction.html)。

## 创建项目

需要先安装 Node.js（使用当前仍在维护的 LTS 版本即可）。

```bash
npm create vue@latest
```

命令会询问项目名称，然后让你选择需要的功能，常见选项有：

- TypeScript
- JSX 支持
- Vue Router（单页应用路由）
- Pinia（状态管理）
- Vitest（单元测试）
- 端到端测试（如 Playwright、Cypress）
- ESLint（代码质量检查）
- Prettier（代码格式化）

选项会随版本变化，按需勾选即可。创建完成后：

```bash
cd my-project
npm install
npm run dev
```

常用脚本：

| 脚本 | 作用 |
| --- | --- |
| `dev` | 启动开发服务器，带热更新 |
| `build` | 类型检查（选了 TypeScript 时用 `vue-tsc`）并构建生产产物到 `dist` |
| `preview` | 本地预览构建产物 |
| `lint` / `format` | 选了 ESLint / Prettier 时生成，运行检查和格式化 |

和 React 的 Vite 项目一样，Vite 开发时只把 TS 转成 JS，不做类型检查。`.vue` 文件的类型检查由 `vue-tsc` 完成，编辑器中需要安装 Vue 官方扩展（Vue - Official）才能获得模板内的类型提示。

## 目录结构

勾选了 TypeScript、Router、Pinia 后，生成的结构大致如下：

```text
my-project/
├── index.html              # 入口 HTML
├── public/                 # 原样复制到产物的静态资源
├── src/
│   ├── main.ts             # 应用入口
│   ├── App.vue             # 根组件
│   ├── assets/             # 会被构建处理的资源（样式、图片）
│   ├── components/         # 通用组件
│   ├── views/              # 路由对应的页面组件
│   ├── router/
│   │   └── index.ts        # 路由配置
│   └── stores/
│       └── counter.ts      # 示例 store
├── env.d.ts                # 类型声明（引入 Vite 客户端类型等）
├── tsconfig.json           # 引用下面几份 tsconfig
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

`vite.config.ts` 中已经配好了 `@` 指向 `src` 的路径别名：

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

tsconfig 中也有对应的 `paths` 配置，所以 `import Foo from '@/components/Foo.vue'` 在构建和类型检查两侧都能解析。新增别名时要两处一起改。

入口文件 `main.ts`：

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

Vue 3 用 `createApp` 创建应用实例，插件、全局组件都注册在这个实例上，而不是像 Vue 2 那样挂在全局的 `Vue` 构造函数上，多个应用实例之间不会互相影响。

## 单文件组件

`.vue` 文件就是单文件组件（SFC），把模板、逻辑、样式放在一个文件里：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ initial?: number }>();
const emit = defineEmits<{ change: [value: number] }>();

const count = ref(props.initial ?? 0);
const double = computed(() => count.value * 2);

function increment() {
  count.value++;
  emit('change', count.value);
}
</script>

<template>
  <button @click="increment">{{ count }}（两倍：{{ double }}）</button>
</template>

<style scoped>
button {
  padding: 4px 12px;
}
</style>
```

- `<script setup>` 是组合式 API 的语法糖：顶层声明的变量、函数和导入的组件可以直接在模板里使用，不需要 `return`。
- `defineProps` / `defineEmits` 是编译器宏，不需要导入，用 TypeScript 类型参数声明 props 和事件。
- `<style scoped>` 让样式只作用于当前组件，编译时会给元素加上唯一的属性选择器。
- SFC 需要 `@vitejs/plugin-vue` 编译，create-vue 已经配置好。

## 组合式 API 最小示例

组合式 API 用函数来组织组件逻辑。几个最常用的 API：

```vue
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';

const keyword = ref('');                  // 基本类型用 ref，脚本中通过 .value 访问
const form = reactive({ page: 1, size: 20 }); // 对象可以用 reactive
const list = ref<string[]>([]);

const isEmpty = computed(() => list.value.length === 0);

watch(keyword, async (val) => {
  form.page = 1;
  list.value = await search(val, form);
});

onMounted(async () => {
  list.value = await search(keyword.value, form);
});

async function search(q: string, params: { page: number; size: number }) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&page=${params.page}`);
  return (await res.json()) as string[];
}
</script>

<template>
  <input v-model="keyword" placeholder="搜索" />
  <p v-if="isEmpty">暂无结果</p>
  <ul v-else>
    <li v-for="item in list" :key="item">{{ item }}</li>
  </ul>
</template>
```

需要注意的地方：

- `ref` 在模板中会自动解包，不用写 `.value`；在 `<script>` 中必须写 `.value`。
- 不要解构 `reactive` 对象：`const { page } = form` 得到的是普通值，失去响应性。需要解构时用 `toRefs(form)`。
- `reactive` 不能整体替换（`form = reactive({...})` 会断开原有引用）。需要整体替换的数据用 `ref`。因此不少团队统一使用 `ref`。
- 可复用的逻辑可以提取成"组合式函数"（约定以 `use` 开头），作用类似 React 的自定义 Hook。

### 依赖注入的响应性

跨层级传递数据可以用 `provide` / `inject`。在 Vue 2 中，`provide` 提供的普通值默认不是响应式的，常见的绕法是提供一个对象，利用对象引用不变、属性是响应式的特点。Vue 3 中直接提供 `ref` 或 `reactive` 即可保持响应性：

```ts
import { ref, provide, inject, type Ref } from 'vue';

// 祖先组件
const theme = ref('dark');
provide('theme', theme);

// 后代组件
const theme = inject<Ref<string>>('theme');
```

推荐由提供方同时提供修改函数，后代组件通过它修改数据，避免数据在任意位置被改写。类型要求严格时可以用 `InjectionKey` 定义注入键。

### 选项式 API 中的 $data 与 $options

选项式 API 中，`this.$data` 是组件当前的响应式数据对象。`this.$options.data` 是组件定义里的 `data` 函数，调用它可以得到一份初始数据，常用于"重置表单"：

```js
Object.assign(this.$data, this.$options.data.call(this));
```

组合式 API 中更直接的做法是把初始值写成一个工厂函数，重置时再调用一次。

## 路由：Vue Router

create-vue 勾选 Router 后会生成 `src/router/index.ts`：

```ts
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/about',
      name: 'about',
      // 路由级代码分割：访问时才加载
      component: () => import('@/views/AboutView.vue'),
    },
  ],
});

export default router;
```

接入要点：

- `App.vue` 中用 `<RouterView />` 渲染匹配的页面，用 `<RouterLink to="/about">` 生成链接。
- 组件内用 `useRoute()` 读取当前路由参数，用 `useRouter()` 进行编程式导航（`router.push`）。
- `createWebHistory` 使用 HTML5 History 模式，URL 没有 `#`，但部署时服务器必须把未命中静态文件的请求回退到 `index.html`，否则刷新子页面会 404。无法配置服务器时改用 `createWebHashHistory`。
- `import.meta.env.BASE_URL` 来自 Vite 的 `base` 配置，部署在子路径下时两者要保持一致。
- 登录校验等逻辑用全局前置守卫 `router.beforeEach` 实现。

## 状态管理：Pinia

Pinia 是 Vue 官方推荐的状态管理库，取代了 Vuex。相比 Vuex，它没有 mutation 的概念，直接在 action 里修改状态；对 TypeScript 的类型推导更好；每个 store 都是独立模块，按需引入。

推荐用组合式写法（setup store）定义 store：

```ts
// src/stores/cart.ts
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const useCartStore = defineStore('cart', () => {
  const items = ref<{ id: string; price: number; qty: number }[]>([]);

  const total = computed(() =>
    items.value.reduce((sum, i) => sum + i.price * i.qty, 0),
  );

  function add(id: string, price: number) {
    const found = items.value.find((i) => i.id === id);
    if (found) found.qty++;
    else items.value.push({ id, price, qty: 1 });
  }

  return { items, total, add };
});
```

在 setup store 中，`ref` 就是 state，`computed` 就是 getter，函数就是 action。也可以用选项式写法 `defineStore('cart', { state, getters, actions })`，效果相同。

在组件中使用：

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useCartStore } from '@/stores/cart';

const cart = useCartStore();
const { items, total } = storeToRefs(cart); // 解构 state 和 getter 要用 storeToRefs
const { add } = cart;                        // action 可以直接解构
</script>
```

store 本身是一个 `reactive` 对象，直接解构会丢失响应性，所以解构 state 和 getter 要用 `storeToRefs`。

:::tip
不是所有数据都要放进 Pinia。只在一个页面使用的状态留在组件内；接口数据如果需要缓存和自动重新请求，可以考虑 TanStack Query 的 Vue 版本。Pinia 适合真正跨页面共享的客户端状态，比如登录用户、购物车、全局设置。
:::

## JSX 支持

大部分场景用模板就够了。确实需要 JSX 时，创建项目时勾选 JSX 支持，或者手动安装 `@vitejs/plugin-vue-jsx` 并加入 Vite 插件列表。Vue CLI 时代使用的 `@vue/babel-preset-jsx` 是面向 Vue 2 的 Babel 预设，不适用于 Vue 3 + Vite 项目。

## 小结

- Vue CLI 已进入维护模式，新项目用 `npm create vue@latest`，生成基于 Vite 的工程。
- 入口用 `createApp` 创建应用实例，插件和路由、Pinia 都注册在实例上。
- 单文件组件推荐 `<script setup lang="ts">`，用 `defineProps` / `defineEmits` 声明接口，`<style scoped>` 隔离样式。
- 组合式 API 注意 `.value`、`reactive` 不能解构也不能整体替换；Vue 3 中 `provide` 一个 `ref` 即可保持响应性。
- Vue Router 用 History 模式时要配置服务器回退；Pinia 取代 Vuex，解构 store 状态要用 `storeToRefs`。

## 参考

- [Vue：快速上手](https://cn.vuejs.org/guide/quick-start.html)
- [Vue：单文件组件](https://cn.vuejs.org/guide/scaling-up/sfc.html)
- [Vue：组合式 API 常见问答](https://cn.vuejs.org/guide/extras/composition-api-faq.html)
- [Vue：依赖注入](https://cn.vuejs.org/guide/components/provide-inject.html)
- [Vue Router 文档](https://router.vuejs.org/zh/)
- [Pinia 文档](https://pinia.vuejs.org/zh/)
