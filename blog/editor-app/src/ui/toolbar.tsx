/** 分组工具栏：组内按钮挨着放（8pt），组与组隔 24pt、中间一条竖细线；一行放不下时整组换到下一行，换行处不画细线。 */
import type { JSX } from "nsh";
import { signal, View } from "nsh";

interface ToolGroup {
  /** 读屏念的组名（「AI」「插入」）。 */
  label: string;
  items: JSX.Element;
}

export function Toolbar(props: { label: string; groups: ToolGroup[]; testID?: string }) {
  // 每组的上边（pt）。这一组和前一组在同一行时，才在两组之间画细线。
  // 细线是绝对定位的，不占位置：换不换行只看按钮，不会因为细线来回跳，也不会为了给细线让位把一组拆开。
  const tops = signal<number[]>([]);
  const sameRowAsPrevious = (i: number) => {
    const t = tops();
    return i > 0 && t[i] !== undefined && t[i - 1] !== undefined && Math.abs(t[i] - t[i - 1]) < 4;
  };
  const place = (i: number, y: number) => {
    if (tops()[i] === y) return;
    tops.update((t) => {
      const next = [...t];
      next[i] = y;
      return next;
    });
  };
  return (
    <View testID={props.testID} role="toolbar" accessibilityLabel={props.label} class="flex-row flex-wrap items-center gap-x-6 gap-y-2">
      {props.groups.map((group, i) => (
        // 一组比整行还宽时（极窄的窗口）组内再换行，不顶出边距。
        <View
          role="group"
          accessibilityLabel={group.label}
          class="relative min-w-0 max-w-full shrink flex-row flex-wrap items-center gap-2"
          onLayout={({ bounds }) => place(i, bounds.origin.y)}
        >
          <If when={sameRowAsPrevious(i)}>
            <View accessibilityElementsHidden class="absolute inset-y-1.5 -left-3 w-px bg-border-strong" />
          </If>
          {group.items}
        </View>
      ))}
    </View>
  );
}
