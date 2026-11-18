/** 卡片对话框和二次确认。对话框：遮罩淡入，卡片从 0.97 上浮 10pt（slow，软落定）。 */
import type { JSX } from "nsh";
import { cleanup, createMotion, effect, keymap, Scroll, Text, View, windowSize } from "nsh";
import { AlertDialog, Dialog as BaseDialog } from "nsh/base";
import { IconButton } from "./button";
import { duration, rise } from "./motion";

/** md 一个短表单，lg 带预览的结果。 */
export type DialogWidth = "md" | "lg";

export interface DialogProps {
  open: boolean;
  /** 用户关掉了（Esc、遮罩、✕）：调用方把 open 设回 false。 */
  onClose: () => void;
  title: string;
  description?: string;
  /** false：进行中不能关（提交 PR 时），没有 ✕，Esc 和遮罩都不关。 */
  dismissible?: boolean;
  width?: DialogWidth;
  /** ⌘/Ctrl + 回车 触发的默认操作（只在打开时生效）。 */
  onShortcut?: () => void;
  /** 底部操作区，从右往左：主操作在最右。 */
  footer?: JSX.Element;
  testID?: string;
  children?: JSX.Element;
}

export function Dialog(props: DialogProps) {
  const dismissible = () => props.dismissible ?? true;
  const card = createMotion({ initial: { opacity: 0 } });
  // 每次打开都从头播；关闭时保持原样，让内容跟着遮罩一起淡出。
  effect(() => {
    if (props.open) void card.play(rise(10, duration.slow));
  });
  // 快捷键只在打开时绑定：同一时刻只有一个对话框拥有 ⌘/Ctrl + 回车。
  effect(() => {
    if (!props.open) return;
    // 焦点在多行输入框里时也要生效（默认会让给输入框的回车）。
    cleanup(keymap.bind("mod+enter", () => props.onShortcut?.(), { when: "always" }));
  });
  return (
    <BaseDialog
      testID={props.testID}
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
      animation="fade"
      accessibilityLabel={props.title}
      accessibilityDescription={props.description}
      closeOnEscape={dismissible()}
      closeOnBackdropPress={dismissible()}
      closeOnSwipe={dismissible()}
      backdropClass="bg-scrim"
      class={props.width === "lg" ? "m-auto w-full max-w-3xl p-4" : "m-auto w-full max-w-lg p-4"}
    >
      <View class="gap-4 rounded-(--radius-card) border border-border bg-popover p-5 shadow-2xl" style={card.style}>
        <View class="flex-row items-start gap-3">
          <View class="flex-1 gap-1">
            <Text role="header" class="text-lg font-semibold text-strong">
              {props.title}
            </Text>
            <If when={props.description}>
              <Text class="text-sm text-muted-foreground">{props.description}</Text>
            </If>
          </View>
          <If when={dismissible()}>
            <IconButton icon="close" label="关闭" size="sm" onPress={props.onClose} />
          </If>
        </View>
        <Scroll style={{ maxHeight: Math.max(240, windowSize().height * 0.62) }}>
          <View class="gap-4">{props.children}</View>
        </Scroll>
        <If when={props.footer}>
          <View class="flex-row flex-wrap items-center justify-end gap-2">{props.footer}</View>
        </If>
      </View>
    </BaseDialog>
  );
}

/**
 * 二次确认（平台的 AlertDialog）：`confirmLabel` 写结果动词，`destructive` 用于不能撤销的替换和清空。
 * 回车确认、Esc 取消，由平台处理。
 */
export async function confirm(options: { title: string; description?: string; confirmLabel: string; destructive?: boolean }): Promise<boolean> {
  const { action } = await AlertDialog.show({
    title: options.title,
    description: options.description,
    actions: [
      { id: "cancel", label: "取消", role: "cancel" },
      { id: "confirm", label: options.confirmLabel, role: options.destructive ? "destructive" : "default" },
    ],
    closeOnEscape: true,
  });
  return action === "confirm";
}
