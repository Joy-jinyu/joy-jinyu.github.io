/** 可折叠的一段：标题行（箭头 + 标题 + 右侧说明）按下展开 / 收起，内容用 Collapsible 的高度展开。 */
import type { JSX } from "nsh";
import { platform, Text, View } from "nsh";
import { Collapsible } from "nsh/base";
import { Icon } from "./icon";

const pointer = platform.desktop;

/** `open` 由调用方管（可以自己展开收起，比如流式输出开始时收起）；`onToggle` 是用户按了标题行。 */
export function Disclosure(props: { label: string; open: boolean; onToggle: () => void; meta?: string; testID?: string; children?: JSX.Element }) {
  return (
    <Collapsible
      testID={props.testID}
      open={props.open}
      reveal
      class="rounded-(--radius) border border-border"
      content={<View class="px-3 pb-3">{props.children}</View>}
    >
      <View
        role="button"
        accessibilityLabel={props.label}
        accessibilityState={{ expanded: props.open }}
        onPress={props.onToggle}
        class="flex-row items-center gap-2 rounded-(--radius) px-3 transition-colors duration-180 ease-settle hover:bg-hover active:bg-pressed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        classList={{ "min-h-8": pointer, "min-h-11": !pointer }}
      >
        <View class="transition-transform duration-240 ease-settle motion-reduce:transition-none" classList={{ "rotate-90": props.open }}>
          <Icon name="chevron" size="sm" tone="muted" />
        </View>
        <Text class="flex-1 text-xs font-medium text-muted-foreground">{props.label}</Text>
        <If when={props.meta}>
          <Text class="font-mono text-xs tabular-nums text-faint">{props.meta}</Text>
        </If>
      </View>
    </Collapsible>
  );
}
