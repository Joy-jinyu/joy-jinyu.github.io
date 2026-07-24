---
title: Redux 状态管理
description: Redux 的三大原则、action/reducer/store 与单向数据流、中间件和异步处理，以及官方推荐的 Redux Toolkit 写法和 react-redux Hooks，最后讨论什么时候不需要 Redux。
---

Redux 是一个可预测的全局状态容器：所有状态集中在一个 store 里，只能通过派发 action、由纯函数 reducer 计算出新状态。这篇先讲 Redux 的核心概念和数据流，再讲中间件和异步，然后用 Redux Toolkit（RTK）写出现在官方推荐的版本，最后说明什么场景用不着 Redux。

## 三大原则

### 单一数据源

整个应用的全局状态存放在一个 store 的一棵对象树里。好处是状态集中、易于调试，可以方便地把整棵状态序列化保存、在服务端渲染时注入，或者用开发者工具回放。

### state 是只读的

不能直接修改 state，唯一的改变方式是派发（dispatch）一个 action。action 是描述"发生了什么"的普通对象。所有修改都集中、按顺序发生，不存在多处代码同时改同一份数据的竞争，每一次变化都可以被记录和追踪。

### 使用纯函数执行修改

描述 action 如何改变 state 的是 reducer：`(state, action) => newState`。reducer 必须是纯函数：

- 相同输入一定得到相同输出；
- 不修改传入的 state，而是返回新对象；
- 不做副作用（请求、随机数、读取当前时间、修改外部变量）。

正因为 reducer 是纯的，状态变化才可预测、可测试，并支持"时间旅行"调试。

## 核心概念

### action

```js
{ type: 'todos/added', payload: { id: 1, text: '买牛奶' } }
```

`type` 是必需字段，通常写成"领域/事件"的形式。其余数据惯例放在 `payload` 里。返回 action 的函数叫 action creator：

```js
const todoAdded = (todo) => ({ type: 'todos/added', payload: todo });
```

action 应该描述"发生了什么事件"（`todos/added`），而不是"要执行什么 setter"（`setTodos`）。这样同一个 action 可以被多个 reducer 响应，也更便于在调试工具里读懂。

### reducer

```js
const initialState = { items: [] };

function todosReducer(state = initialState, action) {
  switch (action.type) {
    case 'todos/added':
      return { ...state, items: [...state.items, action.payload] };
    case 'todos/toggled':
      return {
        ...state,
        items: state.items.map((t) =>
          t.id === action.payload ? { ...t, done: !t.done } : t,
        ),
      };
    default:
      return state; // 不认识的 action 必须原样返回
  }
}
```

应用变大以后，按领域拆成多个 reducer，再用 `combineReducers` 组合成根 reducer，每个 reducer 只负责状态树中的一部分：

```js
const rootReducer = combineReducers({ todos: todosReducer, user: userReducer });
```

### store

store 把这一切串起来，提供三个方法：

- `getState()`：读取当前状态；
- `dispatch(action)`：派发 action，这是更新状态的唯一途径；
- `subscribe(listener)`：注册监听函数，每次 dispatch 后调用。

## 数据流

Redux 是严格的单向数据流：

1. 界面上发生事件，比如用户点击按钮。
2. 代码派发一个 action：`dispatch({ type: 'todos/added', payload })`。
3. store 用当前 state 和这个 action 调用根 reducer，得到新的 state 并保存。
4. store 通知所有订阅者。
5. 订阅了相关数据的 UI 组件检查自己用到的数据是否变化，变了就重新渲染。

```text
UI 事件 → dispatch(action) → reducer(state, action) → 新 state → 通知订阅者 → UI 更新
```

所有状态变化都走同一条路，所以出问题时只要看"派发了哪些 action、每次状态变成了什么"，就能还原整个过程。

## 中间件与异步

reducer 必须是纯函数，那异步请求这样的副作用放在哪里？答案是中间件。

### 中间件

中间件包裹了 `dispatch`，在 action 到达 reducer 之前可以对它做任何事：打日志、拦截、转换、发起异步操作后再派发新的 action。签名是三层柯里化函数：

```js
const logger = (storeApi) => (next) => (action) => {
  console.log('dispatching', action);
  const result = next(action); // 交给下一个中间件，最后到 reducer
  console.log('next state', storeApi.getState());
  return result;
};
```

- `storeApi` 提供 `getState` 和 `dispatch`；
- `next` 是下一个中间件（或最终的原始 dispatch）；
- `action` 是被派发的东西。

多个中间件组成一条链，action 依次经过。中间件可以接收的不一定是普通对象，这正是处理异步的入口。

### thunk

redux-thunk 是最常用的异步中间件。它的逻辑很简单：如果派发的是一个函数，就调用它并传入 `dispatch` 和 `getState`；否则交给下一个中间件。

```js
const fetchTodos = () => async (dispatch, getState) => {
  dispatch({ type: 'todos/loading' });
  try {
    const res = await fetch('/api/todos');
    const data = await res.json();
    dispatch({ type: 'todos/loaded', payload: data });
  } catch (err) {
    dispatch({ type: 'todos/failed', error: String(err) });
  }
};

dispatch(fetchTodos());
```

异步逻辑写在 thunk 里，reducer 依然只处理普通 action，保持纯净。更复杂的场景（取消、竞态、复杂流程编排）可以用 redux-saga、redux-observable，或 RTK 自带的 listener 中间件，但大多数应用用 thunk 就够了。

## Redux Toolkit

上面的"手写 Redux"有几个痛点：样板代码多（action type 常量、action creator、switch）、不可变更新容易写错、store 配置繁琐。Redux 官方现在推荐用 Redux Toolkit 编写所有 Redux 逻辑，旧的 `createStore` 已被标记为弃用。

```bash
npm install @reduxjs/toolkit react-redux
```

### createSlice

`createSlice` 把一块状态的初始值、reducer 和对应的 action creator 写在一起：

```ts
// src/features/todos/todosSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type Todo = { id: string; text: string; done: boolean };
type TodosState = { items: Todo[]; status: 'idle' | 'loading' | 'failed' };

const initialState: TodosState = { items: [], status: 'idle' };

const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    todoAdded(state, action: PayloadAction<Todo>) {
      state.items.push(action.payload); // 看似可变，实际由 Immer 生成新对象
    },
    todoToggled(state, action: PayloadAction<string>) {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) todo.done = !todo.done;
    },
  },
});

export const { todoAdded, todoToggled } = todosSlice.actions;
export default todosSlice.reducer;
```

- action type 自动生成为 `todos/todoAdded` 这样的字符串，action creator 也自动生成。
- reducer 内部用了 Immer：可以直接"修改" `state` 草稿，Immer 会据此生成新的不可变对象。

:::caution
Immer 的"可变写法"只在 `createSlice` / `createReducer` 的 reducer 内部有效。在组件或其他地方直接修改从 store 读出的对象仍然是错误的。另外，在 reducer 中要么修改草稿、要么返回一个新值，不要两者同时做。
:::

### configureStore

```ts
// src/app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import todosReducer from '@/features/todos/todosSlice';

export const store = configureStore({
  reducer: {
    todos: todosReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

`configureStore` 默认做了这些事：用对象形式的 `reducer` 自动调用 `combineReducers`；内置 thunk 中间件；开发环境下加入检查中间件，发现"在 reducer 外修改了 state"或"往 state 里放了不可序列化的值"时报警；接入 Redux DevTools 浏览器扩展。

### createAsyncThunk

`createAsyncThunk` 封装了"发请求并派发 pending / fulfilled / rejected 三种 action"的模式：

```ts
import { createAsyncThunk } from '@reduxjs/toolkit';

export const fetchTodos = createAsyncThunk('todos/fetch', async () => {
  const res = await fetch('/api/todos');
  if (!res.ok) throw new Error('请求失败');
  return (await res.json()) as Todo[];
});
```

在 slice 中用 `extraReducers` 响应这些自动生成的 action：

```ts
const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    /* ... */
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchTodos.fulfilled, (state, action) => {
        state.status = 'idle';
        state.items = action.payload;
      })
      .addCase(fetchTodos.rejected, (state) => {
        state.status = 'failed';
      });
  },
});
```

`reducers` 里的 case 会自动生成 action creator；`extraReducers` 用来响应别处定义的 action（如异步 thunk 或其他 slice 的 action），不会生成新的 action creator。

### RTK Query

如果全局状态里大部分是"从接口拿来的数据"，RTK 还提供了 RTK Query：声明接口后自动生成请求 Hooks，处理缓存、加载状态、去重和失效后重新请求，不需要再手写 thunk 和 loading 字段。

## 配合 react-redux

### Provider

在应用根部注入 store：

```tsx
import { Provider } from 'react-redux';
import { store } from '@/app/store';

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
```

### 带类型的 Hooks

为了不在每个组件里重复写 `RootState` 类型，先定义一份带类型的 Hooks：

```ts
// src/app/hooks.ts
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

`withTypes` 是 react-redux 较新版本提供的方法；旧版本中的等价写法是用 `TypedUseSelectorHook<RootState>` 给 `useSelector` 标注类型。

### useSelector 与 useDispatch

```tsx
function TodoList() {
  const todos = useAppSelector((state) => state.todos.items);
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchTodos());
  }, [dispatch]);

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id} onClick={() => dispatch(todoToggled(t.id))}>
          {t.text}
        </li>
      ))}
    </ul>
  );
}
```

`useSelector` 的工作方式决定了几条使用规则：

- 每次 dispatch 后，它会重新执行 selector，并用**引用相等（`===`）** 比较新旧结果，不相等才让组件重新渲染。
- 因此 selector 不要每次都返回新对象或新数组。`state => state.todos.items.filter(t => !t.done)` 每次都返回新数组，会导致组件在任何 action 后都重新渲染。
- 解决办法：拆成多次 `useSelector` 只选取原始值；或者用 `createSelector`（来自 Reselect，RTK 已重新导出）创建记忆化的 selector，只有输入变化时才重新计算。

```ts
import { createSelector } from '@reduxjs/toolkit';

const selectItems = (state: RootState) => state.todos.items;
export const selectUndone = createSelector([selectItems], (items) =>
  items.filter((t) => !t.done),
);
```

- 选取尽可能小的数据。只需要数量就选 `state.todos.items.length`，而不是整个列表。

## 何时不需要 Redux

Redux 带来了集中、可追踪的状态管理，代价是多一层概念和代码。以下情况通常不需要它：

| 情况 | 更合适的方案 |
| --- | --- |
| 状态只在一个组件或一小块子树中使用 | `useState` / `useReducer`，状态放在最近的公共父组件 |
| 少量全局、变化不频繁的数据（主题、语言、当前用户） | Context |
| 大部分"全局状态"其实是接口数据 | TanStack Query、SWR 等服务端状态库，或 RTK Query |
| 需要轻量的全局客户端状态 | Zustand、Jotai 等更轻的库 |
| 表单状态 | 组件局部 state，或 React Hook Form 等表单库 |
| 页面筛选条件需要可分享 | 放在 URL 查询参数里 |

适合引入 Redux 的信号：

- 很多组件在应用的不同位置需要读写同一份客户端状态；
- 状态更新逻辑复杂，需要集中管理和测试；
- 团队较大，需要统一的状态修改方式和可追溯的调试手段；
- 需要撤销/重做、状态持久化、操作日志等依赖"所有变化都是 action"的能力。

:::tip
Context 不是 Redux 的替代品，两者解决的问题不同。Context 只是把一个值往下传递的机制，本身不管理状态，值变化时所有消费者都会重新渲染；Redux 是状态管理库，`useSelector` 让组件只在自己选取的数据变化时更新。小规模共享用 Context，状态多、更新频繁、逻辑复杂时再考虑 Redux。
:::

## 小结

- 三大原则：单一数据源、state 只读（只能派发 action 修改）、用纯函数 reducer 计算新状态。
- 数据流是单向的：dispatch → reducer → 新 state → 通知订阅者 → UI 更新。
- 副作用放在中间件里处理；thunk 让 action creator 可以返回函数，执行异步逻辑后再派发普通 action。
- 新代码使用 Redux Toolkit：`configureStore` 内置常用配置，`createSlice` 借助 Immer 简化不可变更新，`createAsyncThunk` 处理异步请求的三种状态。
- `useSelector` 按引用比较结果，selector 要选小数据、避免每次返回新对象，必要时用 `createSelector` 记忆化。
- 接口数据交给服务端状态库，局部状态留在组件内，剩下真正复杂的全局客户端状态再考虑 Redux。

## 参考

- [Redux：基础概念与数据流](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)
- [Redux：三大原则](https://redux.js.org/understanding/thinking-in-redux/three-principles)
- [Redux：中间件](https://redux.js.org/understanding/history-and-design/middleware)
- [Redux Toolkit：快速开始](https://redux-toolkit.js.org/introduction/getting-started)
- [Redux Toolkit：createAsyncThunk](https://redux-toolkit.js.org/api/createAsyncThunk)
- [React Redux：Hooks](https://react-redux.js.org/api/hooks)
