/** 应用的动效 token：时长、缓动、距离、缩放。类名里的同一套值见 DESIGN.md「动效 token」。 */
import { Easing, type MotionSpec } from "nsh";

/** 时长（毫秒）。 */
export const duration = { instant: 120, fast: 180, base: 240, slow: 360, slower: 500 } as const;

/** 软落定：按下和所有进入；类名 `ease-settle`（nsh.json tailwind.ease）。 */
export const settle = Easing.bezier(0.22, 1, 0.36, 1);

/** 位移（pt）：文字上浮 / 弹层滑入 / 列表项进入。 */
export const distance = { label: 4, popup: 8, item: 16 } as const;

/** 列表波浪：行间隔和最多错开的行数。 */
export const wave = { gap: 40, cap: 10 } as const;

/** 从下方 `by` 点上浮淡入，同时从 0.97 放大。减少动效时 createMotion 直接到位。 */
export function rise(by: number = distance.popup, ms: number = duration.slow, delay = 0): MotionSpec {
  return {
    duration: ms,
    delay,
    easing: settle,
    keyframes: { opacity: [0, 1], translateY: [by, 0], scale: [0.97, 1] },
  };
}

/** 只淡入，用于同级内容交叉切换。 */
export function fade(ms: number = duration.base): MotionSpec {
  return { duration: ms, easing: settle, keyframes: { opacity: [0, 1] } };
}

/** 标记交换：从 0.6 放大淡入（步骤图标、勾）。 */
export function pop(ms: number = duration.base): MotionSpec {
  return { duration: ms, easing: settle, keyframes: { opacity: [0, 1], scale: [0.6, 1] } };
}
