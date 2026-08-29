---
title: React 核心概念与 Hooks
description: 梳理 JSX、组件与 props、state 与不可变更新、渲染与提交、常用 Hooks 的用法和易错点、自定义 Hook、key、受控组件以及性能优化要点。
---

这篇按"写一个函数组件会碰到什么"的顺序整理 React 的核心概念：JSX 是什么、props 和 state 怎么流动、一次更新怎样变成屏幕上的变化，然后逐个讲常用 Hooks 的用法和容易踩的坑，最后是 key、表单和性能优化。读完应该能解释大部分"为什么没更新""为什么执行了两次""为什么拿到的是旧值"一类的问题。

## JSX

JSX 是 JavaScript 的语法扩展，构建时会被编译成函数调用。React 17 起使用新的 JSX 转换，不再需要在每个文件里 `import React`：

```tsx
const el = <button className="primary" onClick={save}>保存</button>;
// 大致编译为
import { jsx as _jsx } from 'react/jsx-runtime';
const el = _jsx('button', { className: 'primary', onClick: save, children: '保存' });
```

所以 JSX 的结果只是一个普通对象（React 元素），描述"想要渲染什么"，本身不是 DOM。

几条规则：

- 大括号 `{}` 里放任意 JS 表达式，不能放语句（`if`、`for`）。条件渲染用三元或 `&&`，列表用 `map`。
- 一个 JSX 表达式只能有一个根元素，不想多包一层 `div` 就用 Fragment：`<>...</>`，需要带 `key` 时写 `<Fragment key={id}>`。
- DOM 属性用驼峰命名，和 HTML 有几处差异：`class` 写成 `className`，`for` 写成 `htmlFor`，`style` 接收对象（`style={{ fontSize: 14 }}`），设置原始 HTML 用 `dangerouslySetInnerHTML={{ __html: str }}`（内容必须可信或经过消毒，否则有 XSS 风险）。
- `&&` 左侧是数字 `0` 时会渲染出 `0`。写 `{list.length > 0 && <List />}` 而不是 `{list.length && <List />}`。

### 事件

JSX 上的 `onClick` 等事件是 React 的合成事件，它包装了原生事件，在不同浏览器下表现一致。React 17 起事件委托挂在应用的根容器上，而不是 `document`。

事件处理默认在冒泡阶段触发，要在捕获阶段处理就在事件名后加 `Capture`，例如 `onClickCapture`。

## 组件与 props

组件就是返回 JSX 的函数，名字必须大写开头（小写会被当成 HTML 标签）。props 是父组件传给子组件的参数，对子组件来说是**只读**的：

```tsx
type CardProps = {
  title: string;
  children?: React.ReactNode;
};

function Card({ title, children }: CardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

<Card title="设置">
  <p>内容</p>
</Card>;
```

`children` 就是写在组件标签之间的内容。它可以是任何可渲染的东西，也可以是函数（render props 模式）。

数据单向流动：父组件通过 props 往下传数据，子组件想改父组件的数据，只能调用父组件传下来的回调函数。

### 拆组件的思路

react.dev 的"React 哲学"给出了一套从设计稿到组件的步骤：

1. 按设计稿把界面拆成组件层级，一个组件只做一件事。
2. 先用 props 写一个只渲染不交互的静态版本。
3. 找出 UI 状态的最小且完整的表示：能从别的数据算出来的，不是 state。
4. 确定每个 state 放在哪里：放在所有用到它的组件的最近公共父组件上。
5. 添加反向数据流：子组件通过回调修改父组件的 state。

第 3 步最容易被忽略。比如有了 `items` 和 `filter`，过滤后的列表应该在渲染时算出来，而不是再存一份 `filteredItems` state，否则要手动保持两者同步。

## state 与不可变更新

state 是组件"记住"的数据，变化时会触发重新渲染。

```tsx
const [count, setCount] = useState(0);
```

### state 是快照

每次渲染时，`count` 是这一次渲染的固定值。调用 `setCount` 不会改变当前这次渲染里的 `count`，而是安排一次新的渲染：

```tsx
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  console.log(count); // 仍是旧值
}
// 点一次只加 1，因为两次都基于同一个 count 计算
```

要基于上一次的结果更新，传更新函数：

```tsx
setCount((c) => c + 1);
setCount((c) => c + 1); // 点一次加 2
```

React 18 起，所有更新（包括在 `setTimeout`、Promise 回调里触发的）都会自动批处理：同一个事件里的多次 `setState` 只引起一次重新渲染。

### 不可变更新

React 用 `Object.is` 比较新旧 state，引用没变就认为没变化，可能跳过渲染。所以对象和数组要创建新值，而不是原地修改：

```tsx
// 错误：原地修改，引用不变
user.name = 'Tom';
setUser(user);

// 正确
setUser({ ...user, name: 'Tom' });
setList([...list, item]); // 添加
setList(list.filter((x) => x.id !== id)); // 删除
setList(list.map((x) => (x.id === id ? { ...x, done: true } : x))); // 修改某一项
```

嵌套很深时手写展开很繁琐，可以借助 Immer 这类库，用"可变"写法生成不可变结果。数组的 `sort`、`reverse`、`splice` 会修改原数组，先复制再调用，或使用新的 `toSorted`、`toReversed`、`toSpliced`。

## 渲染与提交

"渲染"在 React 里有特定含义，一次更新分三步：

1. **触发**：首次挂载，或某个组件的 state 发生了变化。
2. **渲染**：React 调用组件函数，得到新的 JSX，并和上一次的结果对比，算出需要的改动。父组件重新渲染时，默认会递归渲染它的所有子组件。
3. **提交**：把改动应用到 DOM 上。只改变化的部分，没变的 DOM 节点不会被碰。之后浏览器再进行绘制。

推论：

- 组件函数应当是纯函数：相同的 props 和 state 返回相同的 JSX，不在渲染过程中修改外部变量、发请求、操作 DOM。这些副作用应放进事件处理函数或 Effect。
- "重新渲染"不等于"DOM 被更新"。组件函数被调用了，但如果结果没变，DOM 不会动。
- 开发环境下的 `StrictMode` 会把组件函数调用两次，用来发现不纯的渲染逻辑。只在开发环境生效，不影响生产。

协调和 diff 的细节见 [React 协调与 Fiber](/notes/fronted/language/react/algorithm.html)。

## Hooks 规则

Hooks 是以 `use` 开头的函数，只能在以下位置调用：

- 函数组件或自定义 Hook 的**顶层**；
- 不能在条件、循环、嵌套函数、`try/catch` 中调用。

原因是 React 按调用顺序把每个 Hook 和它的状态对应起来。如果某次渲染因为条件判断少调用了一个 Hook，后面所有 Hook 的状态都会错位。`eslint-plugin-react-hooks` 会检查这条规则。

例外是 React 19 新增的 `use`，它可以在条件语句中调用，用于读取 Promise 或 Context。

## 常用 Hooks

### useState

```tsx
const [value, setValue] = useState(initial);
```

- 初始值只在首次渲染时使用。如果初始值计算开销大，传一个函数：`useState(() => parse(raw))`，而不是 `useState(parse(raw))`，后者每次渲染都会执行 `parse`。
- 不要把 props 直接复制到 state 再期望它跟着 props 变：`useState(props.value)` 只在首次生效。如果确实需要"props 变了就重置"，给组件换一个 `key`（见后文）。

### useEffect

Effect 用来让组件和外部系统保持同步：订阅事件、连接 WebSocket、操作非 React 管理的 DOM、发起请求等。

```tsx
useEffect(() => {
  const conn = createConnection(roomId);
  conn.connect();
  return () => conn.disconnect(); // 清理函数
}, [roomId]);
```

执行时机：提交到 DOM 之后执行，通常在浏览器绘制之后。依赖变化时，先执行上一次的清理函数，再执行新的 Effect；组件卸载时执行清理。

依赖数组的三种写法：

| 写法 | 含义 |
| --- | --- |
| 不传 | 每次渲染后都执行 |
| `[]` | 只在挂载后执行一次，卸载时清理 |
| `[a, b]` | 挂载后执行，之后 `a` 或 `b` 变化时再执行 |

易错点：

- **依赖要写全。** Effect 里用到的 props、state、组件内定义的函数都应列为依赖。漏写会让 Effect 读到旧值（过期闭包）。不要为了"只执行一次"而故意漏写依赖，应该调整代码结构。
- **开发环境执行两次。** `StrictMode` 下组件挂载后会立刻"卸载再挂载"一次，于是 Effect 会执行 → 清理 → 再执行。这是在检查清理函数写得对不对，正确的做法是补全清理逻辑，而不是想办法阻止第二次执行。
- **请求的竞态。** 参数快速变化时，先发的请求可能后返回，覆盖新结果。用清理函数标记过期：

  ```tsx
  useEffect(() => {
    let ignore = false;
    fetchUser(id).then((data) => {
      if (!ignore) setUser(data);
    });
    return () => {
      ignore = true;
    };
  }, [id]);
  ```

  实际项目中，数据请求更推荐交给 TanStack Query 这类库或框架自带的数据获取方案，它们处理了缓存和竞态。
- **很多场景不需要 Effect。** 由 props/state 计算出的值直接在渲染时算；用户操作引起的逻辑写在事件处理函数里。"监听 state A 变化，再 setState B"往往说明 B 是多余的 state。

`useLayoutEffect` 的签名相同，区别是它在 DOM 更新后、浏览器绘制前同步执行，适合需要先测量布局再调整、避免闪烁的场景。它会阻塞绘制，非必要不用。

### useRef

```tsx
const inputRef = useRef<HTMLInputElement>(null);
const timerRef = useRef<number | null>(null);
```

`useRef` 返回一个在组件整个生命周期内保持不变的对象 `{ current }`。两个用途：

1. 引用 DOM 节点：`<input ref={inputRef} />`，提交后 `inputRef.current` 指向该节点。
2. 保存不参与渲染的可变值，比如定时器 id、上一次的值。

修改 `ref.current` **不会**触发重新渲染。反过来，需要显示在界面上的值不要放在 ref 里。也不要在渲染过程中读写 `ref.current`（初始化除外），应在事件处理函数或 Effect 中使用。

把 ref 传给自定义组件：React 19 起函数组件可以直接把 `ref` 当作普通 prop 接收；之前的版本需要用 `forwardRef` 包装组件。

### useMemo 与 useCallback

```tsx
const visible = useMemo(() => filterTodos(todos, tab), [todos, tab]);
const handleSubmit = useCallback((data: Form) => post(id, data), [id]);
```

`useMemo` 缓存计算结果，`useCallback` 缓存函数本身（等价于 `useMemo(() => fn, deps)`）。依赖不变时返回上一次的值。

它们只在以下情况有意义：

- 计算确实很耗时（可以用 `console.time` 量一下）；
- 结果作为 props 传给用 `memo` 包裹的子组件，需要保持引用稳定，避免子组件白白重新渲染；
- 结果作为其他 Hook 的依赖，需要避免 Effect 频繁触发。

其余情况加了只会增加代码复杂度和一点比较开销。另外 React Compiler 可以在构建时自动加上类似的缓存，启用后手写 `useMemo` / `useCallback` 的需要会大幅减少。

### useContext

Context 用于把数据"穿透"多层组件传下去，避免逐层传 props：

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light');

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  return (
    <ThemeContext.Provider value={theme}>
      <Page />
    </ThemeContext.Provider>
  );
}

function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>OK</button>;
}
```

React 19 起可以直接写 `<ThemeContext value={theme}>`，`.Provider` 写法仍可用。

注意：

- `useContext` 读取的是组件上方**最近的** Provider；没有 Provider 时用 `createContext` 的默认值。
- Provider 的 `value` 变化时，所有读取该 Context 的组件都会重新渲染，即使它们只用到其中一部分。如果 `value` 是每次渲染都新建的对象（`value={{ user, login }}`），就会导致消费者每次都重新渲染，需要用 `useMemo` 稳定它，或者把频繁变化和很少变化的数据拆成两个 Context。
- Context 适合主题、语言、当前用户这类变化不频繁的数据，不是高频更新的全局状态方案。

### useReducer

当一个 state 的更新逻辑比较复杂，或多个 state 总是一起变化时，用 reducer 把"发生了什么"和"state 怎么变"分开：

```tsx
type State = { items: Item[]; loading: boolean };
type Action =
  | { type: 'loaded'; items: Item[] }
  | { type: 'removed'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { items: action.items, loading: false };
    case 'removed':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
  }
}

const [state, dispatch] = useReducer(reducer, { items: [], loading: true });
dispatch({ type: 'removed', id });
```

reducer 必须是纯函数并返回新对象。`dispatch` 的引用是稳定的，传给子组件不会破坏 `memo`。`useReducer` + Context 可以组成一个小型的全局状态方案，思路和 Redux 一致，见 [Redux 状态管理](/notes/fronted/language/react/redux.html)。

## 自定义 Hook

把多个组件里重复的"状态 + 副作用"逻辑提取成一个以 `use` 开头的函数：

```tsx
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
```

要点：

- 自定义 Hook 复用的是**逻辑**，不是**状态**。两个组件调用同一个 Hook，各自拥有独立的 state。
- 名字必须以 `use` 开头，这样 lint 规则才能检查其中的 Hooks 调用。不调用任何 Hook 的函数不要以 `use` 命名，写成普通函数即可。
- 每次组件渲染，自定义 Hook 都会重新执行，它拿到的是最新的 props 和 state。

## key 的作用

渲染列表时，React 用 `key` 判断新旧两次渲染中"哪个元素是哪个"：

```tsx
{todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
```

- key 只需在兄弟节点之间唯一，应使用数据本身稳定的 id。
- 用数组下标作 key，在列表会插入、删除、重新排序时会出问题：元素位置变了，key 却跟着位置走，React 会把 A 的状态（比如输入框内容、展开状态）错误地复用给 B。只有列表静态不变时用下标才安全。
- 不要在渲染时生成 key（如 `key={Math.random()}`），每次都不同会导致所有节点被销毁重建。

key 还有一个用途：**主动重置组件**。同一位置的组件 key 变了，React 会把它当成新组件，丢弃旧的 state 重新挂载：

```tsx
<Profile key={userId} userId={userId} />
```

切换用户时表单内容自动清空，比在 Effect 里监听 `userId` 再手动重置 state 更简单可靠。

## 受控与非受控组件

表单元素有两种管理方式：

| | 受控组件 | 非受控组件 |
| --- | --- | --- |
| 值存在哪 | React state | DOM 自身 |
| 写法 | `value` + `onChange` | `defaultValue`，需要时用 ref 读取 |
| 适合 | 需要实时校验、联动、格式化输入 | 简单表单、文件上传、接入非 React 库 |

```tsx
// 受控
const [name, setName] = useState('');
<input value={name} onChange={(e) => setName(e.target.value)} />;

// 非受控
const ref = useRef<HTMLInputElement>(null);
<input defaultValue="Tom" ref={ref} />;
// 提交时读取 ref.current?.value
```

注意：

- 设置了 `value` 却没有 `onChange`，输入框会变成只读，React 会给出警告。
- `value` 不要在 `undefined` 和字符串之间切换，否则组件会在非受控和受控之间切换并报警告。初始值用 `''`。
- 复选框用 `checked` / `defaultChecked`，下拉框在 `<select>` 上设置 `value`，而不是在 `<option>` 上写 `selected`。
- `<input type="file">` 的值只能由用户设置，始终是非受控的。

## 性能优化要点

### memo

```tsx
const Row = memo(function Row({ item }: { item: Item }) {
  return <li>{item.name}</li>;
});
```

`memo` 让组件在 props 浅比较未变化时跳过重新渲染。它和 `useMemo` / `useCallback` 要配合使用：如果父组件每次都传入新创建的对象或函数，浅比较永远不相等，`memo` 就失效了。

### 比 memo 更优先的做法

很多时候调整结构就能避免多余渲染，不需要任何缓存 API：

- **把 state 往下移。** 只有输入框用到的 state，放在输入框组件里，而不是放在页面顶层导致整页重新渲染。
- **把内容作为 children 传入。** 外层组件的 state 变化时，作为 `children` 传进来的 JSX 是父级创建的，引用不变，不会重新渲染。
- **避免不必要的 Effect 链。** 一个 Effect 设置 state、触发另一个 Effect 再设置 state，会造成多次渲染。

### 其他手段

- **代码分割**：`React.lazy` 配合 `Suspense` 按需加载组件，常用于按路由拆分。

  ```tsx
  const Settings = lazy(() => import('./Settings'));

  <Suspense fallback={<Spinner />}>
    <Settings />
  </Suspense>;
  ```

- **长列表虚拟化**：只渲染可视区域内的行，可以用 TanStack Virtual、react-window 等库。
- **区分紧急与非紧急更新**：`useTransition`、`useDeferredValue` 让输入保持流畅，耗时的渲染延后执行，详见 [React 协调与 Fiber](/notes/fronted/language/react/algorithm.html)。
- **先测量再优化**：用 React DevTools 的 Profiler 找到真正渲染慢的组件，再决定加不加缓存。

### 错误边界

渲染过程中抛出的错误如果没被捕获，会导致整个应用卸载变成白屏。错误边界组件可以捕获其子树中渲染时的错误并显示降级 UI。目前错误边界只能用 class 组件实现（定义 `static getDerivedStateFromError` 或 `componentDidCatch`），实践中常直接使用 `react-error-boundary` 库。它不捕获事件处理函数和异步代码里的错误，这些要自己 `try/catch`。

:::note
React 19 移除了一批旧 API：`ReactDOM.render`、`ReactDOM.hydrate`、`unmountComponentAtNode`、`findDOMNode` 等。对应的新写法是 `createRoot(el).render()`、`hydrateRoot()`、`root.unmount()`，以及用 ref 获取 DOM 节点。`createPortal` 仍然可用，用于把子节点渲染到父组件 DOM 层级之外（如弹窗挂到 `body` 下）。
:::

## 小结

- JSX 编译为创建 React 元素的函数调用，结果是描述 UI 的普通对象；组件是纯函数，props 只读、数据单向流动。
- state 是每次渲染的快照，依赖旧值更新用函数式写法；对象和数组必须不可变更新。
- 一次更新分为触发、渲染、提交三步；重新渲染不等于 DOM 改变。
- Hooks 只能在顶层调用；Effect 用于和外部系统同步，依赖要写全，清理函数要成对，很多派生数据不需要 Effect。
- key 决定元素身份，列表用稳定 id；换 key 可以重置组件状态。
- 性能优化先调整结构（state 下移、children 传入），再按需使用 `memo` / `useMemo` / `useCallback`，并用 Profiler 验证。

## 参考

- [React：描述 UI](https://react.dev/learn/describing-the-ui)
- [React：渲染和提交](https://react.dev/learn/render-and-commit)
- [React：你可能不需要 Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React：React 哲学](https://react.dev/learn/thinking-in-react)
- [React：内置 Hooks 参考](https://react.dev/reference/react/hooks)
- [React：Hooks 规则](https://react.dev/reference/rules/rules-of-hooks)
