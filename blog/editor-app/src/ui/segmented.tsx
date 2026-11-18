/** 分段控件：一条胶囊轨道，一个选中块由内核滑到当前项（Tabs 的 indicator）。左右方向键在项之间移动。 */
import { platform, Text } from "nsh";
import { Tab, Tabs } from "nsh/base";

const pointer = platform.desktop;

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  class?: string;
}) {
  return (
    <Tabs
      accessibilityLabel={props.label}
      class={`flex-row rounded-full border border-border bg-muted p-0.5 ${props.class ?? ""}`}
      indicatorClass="inset-y-0.5 rounded-full border border-border-strong bg-card shadow-sm"
    >
      <Each of={props.options} key={(o) => o.value}>
        {(option) => (
          <Tab
            selected={props.value === option().value}
            onPress={() => props.onChange(option().value)}
            class="flex-1 items-center justify-center rounded-full px-4 transition-colors duration-180 ease-settle focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
            classList={{ "min-h-7": pointer, "min-h-10": !pointer, "hover:bg-hover": props.value !== option().value }}
          >
            <Text
              class="text-sm transition-colors duration-120"
              classList={{
                "font-medium text-strong": props.value === option().value,
                "text-muted-foreground": props.value !== option().value,
              }}
            >
              {option().label}
            </Text>
          </Tab>
        )}
      </Each>
    </Tabs>
  );
}
