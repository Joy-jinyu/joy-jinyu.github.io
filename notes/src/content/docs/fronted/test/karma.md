---
title: 前端单元测试
description: 从 Karma 的历史定位讲到现代前端测试方案：测试分层、Vitest/Jest 的断言与 mock、组件测试、Playwright 端到端测试和覆盖率。
---

前端测试工具这些年换了好几轮。这篇先交代 Karma 是什么、为什么不再推荐，然后以现在的主流方案为主，讲清测试分层、Vitest / Jest 的基本用法、断言和 mock、组件测试的思路、用 Playwright 做端到端测试，以及覆盖率怎么看。读完应该能给一个新项目搭起一套够用的测试体系。

## Karma 的历史定位

Karma 是一个测试运行器（test runner）：它启动一个本地服务，打开真实浏览器（Chrome、Firefox，早年常用无界面的 PhantomJS），把测试代码加载进去执行，再把结果汇报回命令行。它本身不提供断言和测试语法，需要搭配 Jasmine 或 Mocha 这样的测试框架使用。典型配置是：

| 依赖 | 作用 |
| --- | --- |
| `karma` | 测试运行器本体 |
| `jasmine-core` + `karma-jasmine` | 测试框架及其适配器（提供 `describe` / `it` / `expect`） |
| `karma-chrome-launcher` 等 | 启动对应浏览器 |
| `karma-coverage` | 收集代码覆盖率，需在 `karma.conf.js` 的 `preprocessors` 中为源码配置 `coverage` |

用 `karma init` 交互式生成 `karma.conf.js`，选择测试框架、浏览器、要加载的文件即可。

在 Node.js 还缺少完善的 DOM 模拟时，"在真浏览器里跑单元测试"是保证结果可信的主要方法，Karma 因此在 AngularJS 和 Angular 项目中长期作为默认选择。

:::caution
Karma 已被官方宣布弃用，不再接受新功能和常规问题修复。早年常和它搭配的 PhantomJS 也早已停止维护。新项目不要再选 Karma；存量项目可以按下文的方案逐步迁移。
:::

它被替代的原因：

- 每次运行都要启动浏览器、通过打包工具构建测试代码，反馈慢。
- 配置分散在 Karma、框架适配器、打包工具插件之间，维护成本高。
- jsdom / happy-dom 这类 DOM 模拟已足够覆盖大部分单元和组件测试；真正需要真浏览器的场景，有了 Playwright 这类更好的工具，以及 Vitest 的浏览器模式。

## 测试分层

经典的测试金字塔把测试分为三层，越往下数量越多、跑得越快：

| 层级 | 测什么 | 工具 | 特点 |
| --- | --- | --- | --- |
| 单元测试 | 单个函数、模块、hook | Vitest / Jest | 快、稳定、定位精确 |
| 集成 / 组件测试 | 组件渲染和交互、多个模块协作 | Vitest / Jest + Testing Library | 贴近用户行为，需要模拟 DOM |
| 端到端（E2E）测试 | 完整用户流程，跑在真实浏览器里 | Playwright | 最接近真实，但慢、维护成本高 |

前端社区也常提"测试奖杯"的说法：底部是 TypeScript、ESLint 这类静态检查，重心放在组件 / 集成测试，因为它们的投入产出比最高。两种模型想表达的是同一件事：**大部分测试应该便宜且快，少量昂贵的测试只覆盖核心流程。**

实际分配可以参考：

- 纯逻辑（工具函数、数据转换、状态 reducer）：单元测试覆盖边界情况。
- 交互组件：组件测试覆盖"用户操作后看到什么"。
- 登录、下单、支付这类关键路径：少量 E2E 测试兜底。

## Vitest / Jest 基本用法

Vitest 的 API 与 Jest 基本兼容（`describe` / `it` / `expect`、mock、快照），区别在于 Vitest 复用 Vite 的配置和转换管线，原生支持 ESM 和 TypeScript；Jest 处理 ESM 和 TS 需要额外配置转换器。用 Vite 的项目优先选 Vitest，已有 Jest 体系的项目没必要强行迁移。

### 安装与配置

```bash
npm i -D vitest
```

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

`vitest` 默认进入监听模式，文件变化后只重跑相关测试；CI 中用 `vitest run` 执行一次后退出。默认匹配 `*.test.ts`、`*.spec.ts` 等文件。

### 第一个测试

```ts
// src/utils/price.ts
/** 把分转换成带两位小数的元 */
export function formatPrice(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new TypeError('cents 必须是整数');
  }
  return (cents / 100).toFixed(2);
}
```

```ts
// src/utils/price.test.ts
import { describe, it, expect } from 'vitest';
import { formatPrice } from './price';

describe('formatPrice', () => {
  it('把分转换为元', () => {
    expect(formatPrice(1999)).toBe('19.99');
  });

  it('处理 0', () => {
    expect(formatPrice(0)).toBe('0.00');
  });

  it('非整数抛出 TypeError', () => {
    expect(() => formatPrice(1.5)).toThrow(TypeError);
  });
});
```

一个好的测试用例只验证一件事，名字直接描述预期行为，失败时一眼能看出哪里坏了。

### 常用断言

| 断言 | 用途 |
| --- | --- |
| `toBe(v)` | 严格相等（`Object.is`），用于原始值 |
| `toEqual(v)` | 递归比较值，用于对象、数组 |
| `toStrictEqual(v)` | 比 `toEqual` 更严格，还会检查 `undefined` 属性和对象类型 |
| `toMatchObject(v)` | 只比较给出的部分属性 |
| `toContain(item)` | 数组或字符串包含某项 |
| `toThrow(err?)` | 函数调用时抛错 |
| `toHaveBeenCalledWith(...args)` | mock 函数被以某些参数调用过 |
| `resolves` / `rejects` | 断言 Promise 的结果，如 `await expect(p).resolves.toBe(1)` |

对象比较是常见坑：`expect({ a: 1 }).toBe({ a: 1 })` 会失败，因为是两个不同的对象，应使用 `toEqual`。

## Mock

mock 的目的是**隔离被测代码之外的依赖**：网络请求、定时器、随机数、当前时间、第三方模块。只 mock 边界，不 mock 被测代码内部的实现，否则测试只是在复述代码。

### mock 函数

```ts
import { it, expect, vi } from 'vitest';

it('完成后调用回调', () => {
  const onDone = vi.fn();
  runTask(onDone);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledWith({ ok: true });
});
```

`vi.fn()` 对应 Jest 的 `jest.fn()`，可以记录调用情况，也可以用 `mockReturnValue`、`mockResolvedValue` 指定返回值。`vi.spyOn(obj, 'method')` 用于监听或替换已有对象上的方法。

### mock 模块

```ts
// src/user.ts
import { request } from './request';

/** 获取用户名，失败时返回"游客" */
export async function getUserName(id: string) {
  try {
    const user = await request(`/api/users/${id}`);
    return user.name;
  } catch {
    return '游客';
  }
}
```

```ts
// src/user.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserName } from './user';
import { request } from './request';

vi.mock('./request', () => ({
  request: vi.fn(),
}));

describe('getUserName', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
  });

  it('返回接口中的用户名', async () => {
    vi.mocked(request).mockResolvedValue({ name: '张三' });
    await expect(getUserName('1')).resolves.toBe('张三');
  });

  it('请求失败时返回游客', async () => {
    vi.mocked(request).mockRejectedValue(new Error('network'));
    await expect(getUserName('1')).resolves.toBe('游客');
  });
});
```

`vi.mock` 会被提升到文件顶部执行，所以即使写在 `import` 之后，被测模块拿到的也是 mock 版本。用例之间要重置 mock 状态，避免互相影响。

如果项目里接口调用很多，可以考虑在网络层拦截（例如 MSW），这样测试不依赖具体用了哪个请求库。

### 定时器与时间

```ts
import { it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
});

it('300ms 后才触发', () => {
  vi.useFakeTimers();
  const fn = vi.fn();
  const debounced = debounce(fn, 300);

  debounced();
  vi.advanceTimersByTime(299);
  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
});
```

假定时器让测试不必真的等待，也避免了结果受机器快慢影响。依赖当前时间的逻辑用 `vi.setSystemTime()` 固定时间。

## 组件测试

组件测试推荐 Testing Library 的思路：**像用户一样使用组件，只断言用户能看到的结果。**通过角色、文字、标签查找元素，而不是通过 class 名、组件内部 state 或实例方法。这样重构组件内部实现时，只要行为不变，测试就不用改。

React 示例（Vue 有对应的 `@testing-library/vue`，用法一致）：

```bash
npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
```

```tsx
// Counter.tsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount((c) => c + 1)}>加一</button>
    </div>
  );
}
```

```tsx
// Counter.test.tsx
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

it('点击按钮后计数加一', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  await user.click(screen.getByRole('button', { name: '加一' }));

  expect(screen.getByText('当前计数：1')).toBeInTheDocument();
});
```

几个要点：

- 查询优先级：`getByRole` > `getByLabelText` > `getByText` > `getByTestId`。能用角色查到元素，往往也说明组件的无障碍语义是对的。
- `getBy*` 找不到元素会直接抛错；`queryBy*` 返回 `null`，用于断言"不存在"；`findBy*` 返回 Promise，用于等待异步出现的元素。
- 用 `user-event` 模拟交互，它会触发一次真实操作对应的完整事件序列（如点击前的 pointer、focus 事件），比直接 `fireEvent` 更接近真实。
- jsdom 不做布局和绘制，元素尺寸、滚动位置、CSS 是否生效这类问题测不了，需要交给真实浏览器。

## 端到端测试：Playwright

E2E 测试在真实浏览器中打开页面，模拟完整用户流程。Playwright 支持 Chromium、Firefox、WebKit，内置自动等待（操作前会等元素可见、可点击），这减少了以往 E2E 测试里大量手写 `sleep` 带来的不稳定。

```bash
npm init playwright@latest
```

```ts
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('用户登录后进入首页', async ({ page }) => {
  await page.goto('http://localhost:5173/login');

  await page.getByLabel('用户名').fill('demo');
  await page.getByLabel('密码').fill('secret');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: '首页' })).toBeVisible();
});
```

```bash
npx playwright test          # 运行全部用例
npx playwright test --ui     # 图形界面，便于调试
npx playwright show-report   # 查看 HTML 报告
```

写 E2E 测试的原则：

- 只覆盖关键路径，不要用 E2E 测试去穷举边界情况，那是单元测试的事。
- 每个用例自己准备数据，不依赖其他用例的执行结果和顺序。
- 定位元素和 Testing Library 一样，优先用角色和文字。
- 失败时开启 trace 记录，能回放每一步的页面状态和网络请求，排查效率比看日志高很多。

## 覆盖率

Vitest 支持 V8 和 Istanbul 两种覆盖率实现，默认使用 V8：

```bash
npm i -D @vitest/coverage-v8
npx vitest run --coverage
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
    },
  },
});
```

报告中的四个指标：

| 指标 | 含义 |
| --- | --- |
| Statements | 语句覆盖率 |
| Branches | 分支覆盖率，`if/else`、三元表达式、`&&` 的每个分支是否都走到 |
| Functions | 函数是否被调用过 |
| Lines | 行覆盖率 |

分支覆盖率最能暴露"漏测了哪种情况"。覆盖率只说明代码被执行过，不说明结果被正确断言过：一个没有 `expect` 的测试也能把覆盖率刷高。可以给核心模块设最低阈值（`coverage.thresholds`）防止倒退，但不建议把全局 100% 作为目标。

## 小结

- Karma 是在真实浏览器里跑测试的运行器，已被官方弃用，新项目不再使用。
- 测试按成本分层：大量快速的单元测试，重点投入组件测试，少量 E2E 覆盖关键路径。
- Vitest 与 Jest API 基本兼容，Vite 项目优先选 Vitest；mock 只用于隔离网络、时间、第三方模块等边界。
- 组件测试按用户视角查找元素、模拟交互、断言可见结果，不依赖内部实现。
- Playwright 负责真实浏览器中的端到端流程；覆盖率用于发现漏测，不等于测试质量。

## 参考

- [Vitest 文档](https://vitest.dev/guide/)
- [Jest 文档](https://jestjs.io/docs/getting-started)
- [Testing Library 文档](https://testing-library.com/docs/)
- [Playwright 文档](https://playwright.dev/docs/intro)
