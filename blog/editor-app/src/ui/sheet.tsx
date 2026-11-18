/** 侧栏面板：宽屏从右边滑出，窄屏从底部升起；遮罩、Esc、返回都能关。 */
import type { JSX } from "nsh";
import { Text, token, View, windowSize } from "nsh";
import { Sheet as BaseSheet } from "nsh/base";
import { IconButton } from "./button";

/** 宽于这个值（pt）时从右侧滑出。和写稿页的双栏断点一致。 */
export const WIDE = 900;

export function Sheet(props: { open: boolean; onClose: () => void; title: string; testID?: string; children?: JSX.Element }) {
  const wide = () => windowSize().width >= WIDE;
  return (
    <BaseSheet
      testID={props.testID}
      open={props.open}
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
      side={wide() ? "right" : "bottom"}
      closeOnSwipe
      accessibilityLabel={props.title}
      backdropClass="bg-scrim"
      popupClass="gap-4 bg-popover border-border pb-5 pt-4"
      popupStyle={
        wide()
          ? { width: Math.min(420, windowSize().width - 48), height: "100%", borderLeftWidth: 1 }
          : { height: windowSize().height * 0.78, borderTopWidth: 1, borderTopLeftRadius: token("radius-card"), borderTopRightRadius: token("radius-card") }
      }
    >
      <View class="flex-row items-center gap-3 pl-5 pr-3">
        <Text role="header" class="flex-1 text-lg font-semibold text-strong">
          {props.title}
        </Text>
        <IconButton icon="close" label="关闭" size="sm" onPress={props.onClose} />
      </View>
      <View class="min-h-0 flex-1">{props.children}</View>
    </BaseSheet>
  );
}
