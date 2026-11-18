/** 卡片对话框和二次确认。对话框：遮罩淡入，卡片从 0.97 上浮 10pt（slow，软落定）。 */
import type { JSX } from "nsh";
import { cleanup, createMotion, effect, keymap, Scroll, type ScrollRef, Text, View, windowSize } from "nsh";
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
  /** 内容在流进来（AI 正在写）：内容区固定在最大高度，不随内容长高；停在底部时跟着末尾走，往上翻就不跟。 */
  follow?: boolean;
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
        <FollowScroll follow={!!props.follow} height={Math.max(240, windowSize().height * 0.62)}>
          {props.children}
        </FollowScroll>
        <If when={props.footer}>
          <View class="flex-row flex-wrap items-center justify-end gap-2">{props.footer}</View>
        </If>
      </View>
    </BaseDialog>
  );
}

/** 离底部多近（pt）还算「停在底部」：差一点点也接着跟。 */
const FOLLOW_SLACK = 24;

/** 对话框的内容区：平时最高 `height`；`follow` 时就是 `height` 高，内容长了自己滚到末尾（不带动画），除非用户往上翻了。 */
function FollowScroll(props: { follow: boolean; height: number; children?: JSX.Element }) {
  let scroll: ScrollRef | undefined;
  let pinned = true;
  let lastY = 0;
  let viewHeight = 0;
  let contentHeight = 0;
  const toEnd = () => {
    if (props.follow && pinned && contentHeight > viewHeight) scroll?.scrollTo({ y: contentHeight - viewHeight, animated: false });
  };
  // 每次开始跟随（新一次生成）都从「停在底部」开始。
  effect(() => {
    if (props.follow) pinned = true;
  });
  return (
    <Scroll
      ref={scroll}
      style={props.follow ? { height: props.height } : { maxHeight: props.height }}
      onLayout={(e) => {
        viewHeight = e.bounds.size.height;
        toEnd();
      }}
      onScroll={(e) => {
        // 往上翻就松开；回到底部（用户翻回来或我们滚过去）再接着跟。
        if (e.offset.y < lastY - 1) pinned = false;
        if (e.offset.y + e.size.height >= e.contentSize.height - FOLLOW_SLACK) pinned = true;
        lastY = e.offset.y;
      }}
    >
      <View
        class="gap-4"
        onLayout={(e) => {
          contentHeight = e.bounds.size.height;
          toEnd();
        }}
      >
        {props.children}
      </View>
    </Scroll>
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
