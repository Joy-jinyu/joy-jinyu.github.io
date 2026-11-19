/** 悬停提示的气泡：控件的 `tooltip` 都用它，看起来一样。 */
import type { JSX } from "nsh";
import { Text } from "nsh";
import { Tooltip } from "nsh/base";

/** 桌面上指针停半秒、或键盘把焦点移过来时出现；触屏不出现，所以它只能补充，读屏名里要另外说一遍。淡入淡出 instant，减少动效时直接出现。 */
export function tip(text: string, disabled?: boolean): JSX.Element {
  return (
    <Tooltip
      disabled={disabled}
      class="max-w-64 rounded-(--radius-sm) border border-border bg-popover px-2 py-1 shadow-sm transition-opacity duration-120 motion-reduce:transition-none"
      startingClass="opacity-0"
      endingClass="opacity-0"
    >
      <Text class="text-xs text-strong">{text}</Text>
    </Tooltip>
  );
}
