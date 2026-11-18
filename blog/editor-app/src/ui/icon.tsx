/** 应用的一套字形图标：放在固定宽度的槽里居中，换图标不挪动旁边的文字。 */
import { Text, View } from "nsh";

const GLYPHS = {
  close: "✕",
  check: "✓",
  external: "↗",
  sparkle: "✦",
  dot: "•",
  cross: "✕",
} as const;

export type IconName = keyof typeof GLYPHS;

/** `tone` 只在图标自己表达状态时传；默认继承所在控件的文字色。 */
export type IconTone = "inherit" | "primary" | "muted" | "faint" | "destructive" | "warn" | "on-primary";

/** 装饰性的字形，读屏跳过；有含义时由外层控件的 label 说出来。 */
export function Icon(props: { name: IconName; size?: "sm" | "md"; tone?: IconTone }) {
  return (
    <View
      accessibilityElementsHidden
      class="items-center justify-center"
      classList={{ "size-3.5": props.size === "sm", "size-4": props.size !== "sm" }}
    >
      <Text
        class="leading-none"
        classList={{
          "text-xs": props.size === "sm",
          "text-sm": props.size !== "sm",
          "text-primary": props.tone === "primary",
          "text-muted-foreground": props.tone === "muted",
          "text-faint": props.tone === "faint",
          "text-destructive": props.tone === "destructive",
          "text-warn": props.tone === "warn",
          "text-primary-foreground": props.tone === "on-primary",
        }}
      >
        {GLYPHS[props.name]}
      </Text>
    </View>
  );
}
