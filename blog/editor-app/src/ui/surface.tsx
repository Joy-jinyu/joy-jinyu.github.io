/** 表面和反馈：Card、Badge、Notice、Empty、Skeleton、Separator。 */
import type { JSX } from "nsh";
import { Text, View } from "nsh";
import { Appear } from "./appear";
import { IconButton } from "./button";

/** 卡片：大圆角、细边、卡片底色。`padding` none 时由内容自己留白（滚动区贴边）。 */
export function Card(props: { padding?: "none" | "md" | "lg"; class?: string; testID?: string; children?: JSX.Element }) {
  return (
    <View
      testID={props.testID}
      class={`rounded-(--radius-card) border border-border bg-card ${props.class ?? ""}`}
      classList={{ "p-5 gap-4": props.padding === "md", "p-8 gap-6": props.padding === "lg", "overflow-hidden": props.padding === "none" }}
    >
      {props.children}
    </View>
  );
}

/** 短状态标签，始终带文字；颜色只用于真有含义的状态。 */
export type BadgeTone = "neutral" | "brand" | "warn" | "danger";

export function Badge(props: { label: string; tone?: BadgeTone }) {
  const tone = () => props.tone ?? "neutral";
  return (
    <View
      class="h-5 flex-row items-center self-start rounded-full px-2"
      classList={{
        "bg-muted": tone() === "neutral",
        "bg-primary-tint": tone() === "brand",
        "bg-warn-tint": tone() === "warn",
        "bg-destructive-tint": tone() === "danger",
      }}
    >
      <Text
        class="text-xs font-medium"
        classList={{
          "text-muted-foreground": tone() === "neutral",
          "text-primary": tone() === "brand",
          "text-warn": tone() === "warn",
          "text-destructive": tone() === "danger",
        }}
      >
        {props.label}
      </Text>
    </View>
  );
}

/** 行内提示条：danger 是出错，warn 是需要用户处理的提醒。出现时上浮淡入。 */
export function Notice(props: { tone: "danger" | "warn"; message: string; action?: JSX.Element; onDismiss?: () => void; testID?: string }) {
  return (
    <Appear kind="label" testID={props.testID}>
      <View
        role="alert"
        class="flex-row items-center gap-3 rounded-(--radius) px-3 py-2"
        classList={{ "bg-destructive-tint": props.tone === "danger", "bg-warn-tint": props.tone === "warn" }}
      >
        <Text class="flex-1 text-sm" classList={{ "text-destructive": props.tone === "danger", "text-warn": props.tone === "warn" }}>
          {props.message}
        </Text>
        {props.action}
        <If when={props.onDismiss}>
          <IconButton icon="close" label="关闭提示" size="sm" onPress={() => props.onDismiss?.()} />
        </If>
      </View>
    </Appear>
  );
}

/** 空状态：说明现在是什么情况、下一步做什么。 */
export function Empty(props: { title: string; description?: string; action?: JSX.Element; testID?: string }) {
  return (
    <Appear kind="panel" testID={props.testID} class="items-center gap-2 px-6 py-10">
      <Text class="text-sm font-semibold text-strong">{props.title}</Text>
      <If when={props.description}>
        <Text class="text-center text-sm text-muted-foreground">{props.description}</Text>
      </If>
      <If when={props.action}>
        <View class="pt-2">{props.action}</View>
      </If>
    </Appear>
  );
}

/** 加载占位：形状已知时才用，慢呼吸（减少动效时静止）。 */
export function Skeleton(props: { shape: "line" | "short" | "block" }) {
  return (
    <View
      accessibilityElementsHidden
      class="rounded-(--radius-sm) bg-muted animate-pulse"
      classList={{ "h-4 w-full": props.shape === "line", "h-3 w-1/3": props.shape === "short", "h-16 w-full": props.shape === "block" }}
    />
  );
}

/** 细分隔线，由区域的拥有者画一次。 */
export function Separator() {
  return <View accessibilityElementsHidden class="h-px bg-border" />;
}
