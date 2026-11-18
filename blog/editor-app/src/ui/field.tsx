/** 表单字段：Field（标签行、控件、说明或错误）和它装的输入框 TextInput、TextArea。 */
import type { InputRef, JSX } from "nsh";
import { platform, Text, View } from "nsh";
import { Input } from "nsh/base";
import { Appear } from "./appear";

const pointer = platform.desktop;

export interface FieldProps {
  label: string;
  /** 当前字数；和 `max` 一起给时，标签行右侧显示计数。 */
  count?: number;
  max?: number;
  /** 要显示的错误；调用方决定什么时候给（碰过字段或尝试提交之后）。 */
  error?: string | null;
  /** 没有错误时显示在控件下面的说明。 */
  description?: string;
  /** 标签行右侧的操作（替代计数），如正文上方的 AI 工具。 */
  actions?: JSX.Element;
  /** 只放布局。 */
  class?: string;
  children?: JSX.Element;
}

/** 字段：标签和控件 6pt，控件和说明 6pt；错误出现时上浮淡入。 */
export function Field(props: FieldProps) {
  const over = () => props.max !== undefined && (props.count ?? 0) > props.max;
  const near = () => props.max !== undefined && !over() && (props.count ?? 0) >= props.max * 0.9;
  return (
    <View class={`gap-1.5 ${props.class ?? ""}`}>
      <View class="min-h-7 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Text class="text-sm font-semibold text-strong">{props.label}</Text>
        <If when={props.actions} else={<Counter count={props.count} max={props.max} over={over()} near={near()} />}>
          {/* 窄屏时操作区折到下一行：限宽到父容器，里面的按钮才会继续换行，不会顶出边距 */}
          <View class="min-w-0 max-w-full">{props.actions}</View>
        </If>
      </View>
      {props.children}
      <If when={props.error} else={props.description ? <Text class="text-xs text-muted-foreground">{props.description}</Text> : null}>
        {(message) => (
          <Appear kind="label">
            <Text role="alert" class="text-xs text-destructive">
              {message()}
            </Text>
          </Appear>
        )}
      </If>
    </View>
  );
}

function Counter(props: { count?: number; max?: number; over: boolean; near: boolean }) {
  return (
    <If when={props.max !== undefined}>
      <Text
        accessibilityLabel={`${props.count ?? 0} / ${props.max} 字`}
        class="font-mono text-xs tabular-nums transition-colors duration-120"
        classList={{ "text-destructive": props.over, "text-warn": props.near, "text-faint": !props.over && !props.near }}
      >
        {`${props.count ?? 0} / ${props.max}`}
      </Text>
    </If>
  );
}

export interface TextInputProps {
  /** 读屏名，通常就是 Field 的标签。 */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  readonly?: boolean;
  autoFocus?: boolean;
  /** 回车：提交（单行输入框）。 */
  onSubmit?: () => void;
  onBlur?: () => void;
  testID?: string;
  ref?: (ref: InputRef) => void;
}


/** 单行输入框：桌面 36pt、触屏 44pt 高，和 md 按钮同高。 */
export function TextInput(props: TextInputProps) {
  return (
    <Input
      testID={props.testID}
      ref={props.ref}
      accessibilityLabel={props.label}
      value={props.value}
      onChange={({ value }) => props.onChange(value)}
      onSubmit={() => props.onSubmit?.()}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      readonly={props.readonly}
      autoFocus={props.autoFocus}
      submitBehavior={props.onSubmit ? "submit" : "blurAndSubmit"}
      class="rounded-(--radius) border bg-field px-3 text-sm text-strong placeholder:text-faint transition-colors duration-120 focus:outline-2 focus:outline-offset-1 focus:outline-ring motion-reduce:transition-none"
      classList={{
        "min-h-9 py-1.5": pointer,
        "min-h-11 py-2.5": !pointer,
        "border-input hover:border-faint focus:border-primary": !props.invalid,
        "border-destructive focus:border-destructive": !!props.invalid,
        "opacity-70": !!props.readonly,
      }}
    />
  );
}

/** 多行输入框。`rows`：short 两三行（摘要、额外要求），medium 五六行（提纲），tall 撑满剩余高度（正文）。 */
/** `minHeight`（pt）：调用方按可用高度给的最小高度（正文撑满可视区），只在 tall 时用。 */
export function TextArea(props: TextInputProps & { rows?: "short" | "medium" | "tall"; minHeight?: number }) {
  const rows = () => props.rows ?? "short";
  return (
    <Input
      testID={props.testID}
      ref={props.ref}
      multiline
      accessibilityLabel={props.label}
      value={props.value}
      onChange={({ value }) => props.onChange(value)}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      readonly={props.readonly}
      autoFocus={props.autoFocus}
      style={props.minHeight ? { minHeight: props.minHeight } : undefined}
      class="rounded-(--radius) border bg-field px-3 text-sm text-strong placeholder:text-faint transition-colors duration-120 focus:outline-2 focus:outline-offset-1 focus:outline-ring motion-reduce:transition-none py-2 leading-6"
      classList={{
        "min-h-18": rows() === "short",
        "min-h-36": rows() === "medium",
        "min-h-80 flex-1": rows() === "tall",
        "border-input hover:border-faint focus:border-primary": !props.invalid,
        "border-destructive focus:border-destructive": !!props.invalid,
        "opacity-70": !!props.readonly,
      }}
    />
  );
}
