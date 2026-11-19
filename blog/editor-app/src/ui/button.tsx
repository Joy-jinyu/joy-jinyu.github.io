/** 按钮家族：Button、IconButton、StatusChip。看起来怎样全在这里，功能代码只传 variant / size / 状态。 */
import { platform, Text, View } from "nsh";
import { Button as BaseButton } from "nsh/base";
import { Icon, type IconName, type IconTone } from "./icon";
import { Spinner } from "./spinner";
import { tip } from "./tooltip";

/**
 * primary：一个决策区里唯一的默认提交（回车对应的那个）。secondary：普通可见操作。
 * ghost：顶栏、行内的安静操作。danger：破坏性操作（清空）。
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** 桌面 sm 28 / bar 32 / md 36pt 高，触屏 sm、bar 36 / md 44pt（触控目标）。bar 只给顶栏，和 AI 状态按钮同高。 */
export type ButtonSize = "sm" | "bar" | "md";

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
  /** 不能按时说明为什么（「先写正文」）：悬停提示，并接在读屏名后面。 */
  disabledHint?: string;
  /**
   * start：放在内容列左边缘的 ghost 文字按钮（底栏的「清空…」）往左挪出自己的左内边距和边框，
   * 文字的左边和上面各行标签对齐；按的范围不变。只给 ghost（有底色、有边的按钮挪出去会超出列）。
   */
  edge?: "start";
  /** 只放布局：宽度、flex、对齐、外边距。 */
  class?: string;
  testID?: string;
  onPress?: () => void;
}

/** 左右内边距（pt）：桌面 sm、bar 12 / md 16，触屏 sm、bar 14 / md 20。`edge` 按它算外挪的距离，所以写成数字，不写 px-* 类。 */
const padX = (size: ButtonSize) => (pointer ? (size === "md" ? 16 : 12) : size === "md" ? 20 : 14);
/** 按钮的边框宽（各变体都有一圈，ghost 是透明的）。 */
const BORDER = 1;

/** 图标和文字同色：字形和线条图标都按按钮的文字色画，不靠继承。 */
const ICON_TONE: Record<ButtonVariant, IconTone> = { primary: "on-primary", secondary: "strong", ghost: "foreground", danger: "destructive" };

/** 按钮：洗色悬停、按下缩到 0.97（软落定 180ms）、键盘焦点环在边框外。不能按时整个按钮（图标和文字一起）45% 不透明。 */
export function Button(props: ButtonProps) {
  const v = () => props.variant ?? "secondary";
  const size = () => props.size ?? "md";
  const md = () => size() === "md";
  const inert = () => !!props.disabled || !!props.loading;
  const name = () => props.accessibilityLabel ?? props.label;
  const button = (
    <BaseButton
      testID={props.testID}
      onPress={props.onPress}
      disabled={inert()}
      accessibilityLabel={props.disabled && props.disabledHint ? `${name()}（${props.disabledHint}）` : name()}
      style={{ paddingHorizontal: padX(size()), marginStart: props.edge === "start" ? -(padX(size()) + BORDER) : undefined }}
      class={`flex-row items-center justify-center gap-2 rounded-(--radius) border transition duration-180 ease-settle focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none ${props.disabledHint ? "" : (props.class ?? "")}`}
      classList={{
        // 贴边按钮被往外挪了，焦点环画在里面，免得在窄窗口里被窗口边裁掉
        "focus-visible:outline-offset-2": props.edge !== "start",
        "focus-visible:-outline-offset-2": props.edge === "start",
        "min-h-7": pointer && size() === "sm",
        "min-h-8": pointer && size() === "bar",
        "min-h-9": (pointer && md()) || (!pointer && !md()),
        "min-h-11": !pointer && md(),
        "active:scale-[0.97] motion-reduce:active:scale-100": !inert(),
        "opacity-45": !!props.disabled && !props.loading,
        "opacity-80": !!props.loading,
        "border-transparent bg-primary": v() === "primary",
        "hover:bg-primary-hover active:bg-primary-active": v() === "primary" && !inert(),
        "border-border bg-secondary": v() === "secondary",
        "hover:border-border-strong hover:bg-secondary-hover active:bg-secondary-active": v() === "secondary" && !inert(),
        "border-transparent": v() === "ghost",
        "hover:bg-hover active:bg-pressed": v() === "ghost" && !inert(),
        "border-transparent bg-destructive-tint": v() === "danger",
        "hover:border-destructive/40 active:bg-pressed": v() === "danger" && !inert(),
      }}
    >
      <If when={props.loading} else={props.icon ? <Icon name={props.icon} size={md() ? "md" : "sm"} tone={ICON_TONE[v()]} /> : null}>
        <Spinner size="sm" tone={v() === "primary" ? "on-primary" : "muted"} />
      </If>
      <Text
        style={{ numberOfLines: 1 }}
        class="font-medium"
        classList={{
          "text-xs": size() === "sm",
          "text-sm": size() !== "sm",
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
  // 提示挂在外面一层：不能按的按钮不一定收得到指针。
  // 调用方的布局类（flex-1、self-*、外边距）这时给外面这层
  return props.disabledHint ? <View class={props.class ?? ""} tooltip={tip(props.disabledHint, !props.disabled)}>{button}</View> : button;
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

/**
 * 顶栏的状态按钮：状态点 + 名字，宽屏再接「· 详情」（等宽小字，过长截断，全文在悬停提示和读屏名里）。
 * 外形和顶栏的 Button（size bar）是一家：同高、同圆角、secondary 的底和边。状态写成文字，不只靠点的颜色。
 */
export function StatusChip(props: {
  label: string;
  /** 跟在「·」后面的详情（模型名）；不给就只显示 label。 */
  detail?: string;
  tone: "ok" | "warn" | "neutral";
  accessibilityLabel?: string;
  /** 悬停提示。 */
  hint?: string;
  loading?: boolean;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <BaseButton
      testID={props.testID}
      onPress={props.onPress}
      disabled={props.loading}
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      tooltip={props.hint ? tip(props.hint) : undefined}
      class="min-w-0 flex-row items-center gap-1.5 rounded-(--radius) border border-border bg-secondary transition duration-180 ease-settle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      classList={{
        "min-h-8 px-3": pointer,
        "min-h-9 px-3.5": !pointer,
        "hover:border-border-strong hover:bg-secondary-hover active:scale-[0.97] active:bg-secondary-active motion-reduce:active:scale-100": !props.loading,
        "opacity-80": !!props.loading,
      }}
    >
      <If when={props.loading} else={<StatusDot tone={props.tone} />}>
        <Spinner size="sm" tone="muted" />
      </If>
      <Text style={{ numberOfLines: 1 }} class="text-sm font-medium text-strong">
        {props.label}
      </Text>
      <If when={props.detail}>
        {(detail) => (
          <>
            <Text accessibilityElementsHidden class="text-xs text-faint">
              ·
            </Text>
            <View class="min-w-0 max-w-40 shrink">
              <Text style={{ numberOfLines: 1 }} class="font-mono text-xs text-muted-foreground">
                {detail()}
              </Text>
            </View>
          </>
        )}
      </If>
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
