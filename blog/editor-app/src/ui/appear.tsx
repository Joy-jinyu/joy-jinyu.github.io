/** 挂载时播一次进入动效的容器：页面、结果区、提示条、错误文字都用它。 */
import type { JSX } from "nsh";
import { createMotion, View } from "nsh";
import { distance, duration, rise } from "./motion";

/** 进入的幅度：label 文字上浮 4pt（fast）/ panel 弹层和结果 8pt（slow）/ page 页面 8pt（slow）。 */
export type AppearKind = "label" | "panel" | "page";

const SPEC = {
  label: () => rise(distance.label, duration.fast),
  panel: () => rise(distance.popup, duration.slow),
  page: () => rise(distance.popup, duration.slow),
} as const;

/**
 * 挂载时从下方上浮淡入一次（减少动效时直接到位）。`class` 只放布局。
 * 要在内容变化时重播，就让调用方在变化时重建它（三元表达式或 `If`）。
 */
export function Appear(props: { kind?: AppearKind; delay?: number; class?: string; children?: JSX.Element; testID?: string }) {
  const spec = SPEC[props.kind ?? "panel"]();
  const m = createMotion({ enter: props.delay ? { ...spec, delay: props.delay } : spec });
  return (
    <View testID={props.testID} class={props.class} style={m.style}>
      {props.children}
    </View>
  );
}
