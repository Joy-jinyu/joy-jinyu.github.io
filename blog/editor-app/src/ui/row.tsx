/** 可按的列表行：整行洗色（不缩放），行尾一个固定宽度的图标槽。 */
import type { JSX } from "nsh";
import { platform, Text, View } from "nsh";
import { Button as BaseButton } from "nsh/base";
import { Icon, type IconName } from "./icon";

const pointer = platform.desktop;

export function RowButton(props: {
  title: string;
  /** 标题下的一行元信息（badge、日期）。 */
  meta?: JSX.Element;
  trailing?: IconName;
  /** link：打开站外页面（GitHub 上的 PR）。 */
  role?: "button" | "link";
  accessibilityLabel?: string;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <BaseButton
      testID={props.testID}
      role={props.role ?? "button"}
      accessibilityLabel={props.accessibilityLabel ?? props.title}
      onPress={props.onPress}
      class="flex-row items-center gap-3 rounded-(--radius) px-3 transition-colors duration-180 ease-settle hover:bg-hover active:bg-pressed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
      classList={{ "py-2.5": pointer, "py-3.5": !pointer }}
    >
      <View class="min-w-0 flex-1 gap-1.5">
        <Text style={{ numberOfLines: 2 }} class="text-sm font-medium text-strong">
          {props.title}
        </Text>
        {props.meta}
      </View>
      <If when={props.trailing}>
        <View class="w-4 items-center">
          <Icon name={props.trailing!} tone="faint" />
        </View>
      </If>
    </BaseButton>
  );
}
