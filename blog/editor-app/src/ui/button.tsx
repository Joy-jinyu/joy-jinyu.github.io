/** 按钮家族：Button、IconButton、StatusChip。看起来怎样全在这里，功能代码只传 variant / size / 状态。 */
import { platform, Text, View } from "nsh";
import { Button as BaseButton } from "nsh/base";
import { Icon, type IconName } from "./icon";
import { Spinner } from "./spinner";

/**
 * primary：一个决策区里唯一的默认提交（回车对应的那个）。secondary：普通可见操作。
 * ghost：顶栏、行内的安静操作。danger：破坏性操作（清空）。
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** 桌面 28 / 36pt 高，触屏 36 / 44pt（触控目标）。 */
export type ButtonSize = "sm" | "md";

/** 指针设备（桌面浏览器）用紧凑尺寸，触屏放大到 44pt。启动时决定，运行中不变。 */
const pointer = platform.desktop;

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 它发起的事正在进行：显示 spinner、稍微变暗、不能再按，尺寸不变。 */
  loading?: boolean;
  /** loading 时替换 label 的文字（「生成中…」）。 */
  loadingLabel?: string;
  disabled?: boolean;
  /** 文字前的字形。 */
  icon?: IconName;
  /** 读屏名，默认就是 label。 */
  accessibilityLabel?: string;
  /** 只放布局：宽度、flex、对齐、外边距。 */
  class?: string;
  testID?: string;
  onPress?: () => void;
}

/** 按钮：洗色悬停、按下缩到 0.97（软落定 180ms）、键盘焦点环在边框外。 */
export function Button(props: ButtonProps) {
  const v = () => props.variant ?? "secondary";
  const md = () => (props.size ?? "md") === "md";
  const inert = () => !!props.disabled || !!props.loading;
  return (
    <BaseButton
      testID={props.testID}
      onPress={props.onPress}
      disabled={inert()}
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      class={`flex-row items-center justify-center gap-2 rounded-(--radius) border transition duration-180 ease-settle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${props.class ?? ""}`}
      classList={{
        "min-h-7 px-3": pointer && !md(),
        "min-h-9 px-4": pointer && md(),
        "min-h-9 px-3.5": !pointer && !md(),
        "min-h-11 px-5": !pointer && md(),
        "active:scale-[0.97] motion-reduce:active:scale-100": !inert(),
        "opacity-45": !!props.disabled && !props.loading,
        "opacity-80": !!props.loading,
        "border-transparent bg-primary": v() === "primary",
        "hover:bg-primary-hover active:bg-primary-active": v() === "primary" && !inert(),
        "border-border bg-secondary": v() === "secondary",
        "hover:bg-accent active:bg-pressed": v() === "secondary" && !inert(),
        "border-transparent": v() === "ghost",
        "hover:bg-hover active:bg-pressed": v() === "ghost" && !inert(),
        "border-transparent bg-destructive-tint": v() === "danger",
        "hover:border-destructive/40 active:bg-pressed": v() === "danger" && !inert(),
      }}
    >
      <If when={props.loading} else={props.icon ? <Icon name={props.icon} size={md() ? "md" : "sm"} tone={v() === "primary" ? "on-primary" : "inherit"} /> : null}>
        <Spinner size="sm" tone={v() === "primary" ? "on-primary" : "muted"} />
      </If>
      <Text
        style={{ numberOfLines: 1 }}
        class="font-medium"
        classList={{
          "text-xs": !md(),
          "text-sm": md(),
          "text-primary-foreground": v() === "primary",
          "text-strong": v() === "secondary",
          "text-foreground": v() === "ghost",
          "text-destructive": v() === "danger",
        }}
      >
        {props.loading && props.loadingLabel ? props.loadingLabel : props.label}
      </Text>
    </BaseButton>
  );
}

/** 只有图标的正方形按钮：`label` 是读屏名，必填。按下缩到 0.95。 */
export function IconButton(props: { icon: IconName; label: string; size?: ButtonSize; disabled?: boolean; testID?: string; onPress?: () => void }) {
  const md = () => (props.size ?? "md") === "md";
  return (
    <BaseButton
      testID={props.testID}
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityLabel={props.label}
      class="items-center justify-center rounded-(--radius) text-muted-foreground transition duration-180 ease-settle hover:bg-hover hover:text-strong active:scale-[0.95] active:bg-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100"
      classList={{
        "size-7": pointer && !md(),
        "size-9": pointer && md(),
        "size-9 rounded-full": !pointer && !md(),
        "size-11": !pointer && md(),
      }}
    >
      <Icon name={props.icon} size={md() ? "md" : "sm"} />
    </BaseButton>
  );
}

/** 顶栏的状态胶囊：前面一个状态点，文字说明状态（不靠颜色）。可按。 */
export function StatusChip(props: { label: string; tone: "ok" | "warn" | "neutral"; mono?: boolean; accessibilityLabel?: string; loading?: boolean; testID?: string; onPress?: () => void }) {
  return (
    <BaseButton
      testID={props.testID}
      onPress={props.onPress}
      disabled={props.loading}
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      class="flex-row items-center gap-1.5 rounded-full border border-border px-3 transition duration-180 ease-settle hover:bg-hover active:scale-[0.97] active:bg-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:active:scale-100"
      classList={{ "min-h-7": pointer, "min-h-9": !pointer }}
    >
      <If when={props.loading} else={<StatusDot tone={props.tone} />}>
        <Spinner size="sm" tone="muted" />
      </If>
      <Text style={{ numberOfLines: 1 }} class="text-xs text-foreground" classList={{ "font-mono": !!props.mono }}>
        {props.label}
      </Text>
    </BaseButton>
  );
}

function StatusDot(props: { tone: "ok" | "warn" | "neutral" }) {
  return (
    <View
      accessibilityElementsHidden
      class="size-1.5 rounded-full"
      classList={{ "bg-primary": props.tone === "ok", "bg-warn": props.tone === "warn", "bg-faint": props.tone === "neutral" }}
    />
  );
}
