/** 应用的图标：一套字形（✕ ✓ ↗ ✦ …）和两枚线条 SVG（图表、图片），都放在固定宽度的槽里居中，换图标不挪动旁边的文字。 */
import { Image, Text, View } from "nsh";

const GLYPHS = {
  close: "✕",
  check: "✓",
  external: "↗",
  sparkle: "✦",
  dot: "•",
  cross: "✕",
  chevron: "›",
} as const;

/** 线条图标的 data: 地址：16 视框、1.5 描边、圆头。描边色只当遮罩用（`tint-*` 换成 token 色），所以写 currentColor。 */
const line = (paths: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`)}`;

// 不用 import 的 .svg 资源：tests/ 是另一个应用目录（Gallery 从那里跑），引不到它外面的资源文件。
const LINES = {
  chart: line('<path d="M2.75 2.75v10.5h10.5"/><path d="M5.75 10.25v-2.5"/><path d="M8.75 10.25v-5.5"/><path d="M11.75 10.25v-3.5"/>'),
  image: line('<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2"/><circle cx="5.75" cy="6.25" r="1.1"/><path d="m2.75 11.75 3.25-3.25 2.5 2.5 1.75-1.75 3 3"/>'),
} as const;

export type IconName = keyof typeof GLYPHS | keyof typeof LINES;

/**
 * `tone` 只在图标自己表达状态、或所在控件要它跟文字同色时传；字形 inherit 时继承所在控件的文字色。
 * 线条图标靠 `tint-*` 上色，而 tintColor 不接受 currentColor，没法继承：inherit 时按 foreground 画，放进按钮时由按钮传和文字一样的 tone。
 */
export type IconTone = "inherit" | "strong" | "foreground" | "primary" | "muted" | "faint" | "destructive" | "warn" | "on-primary";

/** 装饰性的图标，读屏跳过；有含义时由外层控件的 label 说出来。 */
export function Icon(props: { name: IconName; size?: "sm" | "md"; tone?: IconTone }) {
  const tone = () => props.tone ?? "inherit";
  return (
    <View
      accessibilityElementsHidden
      class="items-center justify-center"
      classList={{ "size-3.5": props.size === "sm", "size-4": props.size !== "sm" }}
    >
      <If
        when={props.name in LINES}
        else={
          <Text
            class="leading-none"
            classList={{
              "text-xs": props.size === "sm",
              "text-sm": props.size !== "sm",
              "text-strong": tone() === "strong",
              "text-foreground": tone() === "foreground",
              "text-primary": tone() === "primary",
              "text-muted-foreground": tone() === "muted",
              "text-faint": tone() === "faint",
              "text-destructive": tone() === "destructive",
              "text-warn": tone() === "warn",
              "text-primary-foreground": tone() === "on-primary",
            }}
          >
            {GLYPHS[props.name as keyof typeof GLYPHS]}
          </Text>
        }
      >
        <Image
          src={LINES[props.name as keyof typeof LINES]}
          class="size-full"
          classList={{
            "tint-strong": tone() === "strong",
            "tint-foreground": tone() === "foreground" || tone() === "inherit",
            "tint-primary": tone() === "primary",
            "tint-muted-foreground": tone() === "muted",
            "tint-faint": tone() === "faint",
            "tint-destructive": tone() === "destructive",
            "tint-warn": tone() === "warn",
            "tint-primary-foreground": tone() === "on-primary",
          }}
        />
      </If>
    </View>
  );
}
