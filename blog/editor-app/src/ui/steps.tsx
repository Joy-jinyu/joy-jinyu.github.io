/** 进度步骤列表：每步一个标记（未开始的点 → 进行中的 spinner → 完成的勾 / 失败的叉），状态同时写在读屏名里。 */
import { computed, createMotion, Text, View } from "nsh";
import { Icon } from "./icon";
import { pop } from "./motion";
import { Spinner } from "./spinner";

export type StepState = "pending" | "active" | "done" | "error";

export interface Step {
  id: string;
  label: string;
  state: StepState;
}

const SPOKEN: Record<StepState, string> = { pending: "未开始", active: "进行中", done: "完成", error: "失败" };

export function StepList(props: { steps: Step[]; testID?: string }) {
  return (
    <View testID={props.testID} role="list" class="gap-3">
      <Each of={props.steps} key={(s) => s.id}>
        {(step) => {
          // 只在状态真的变了时重建标记（同一状态的新对象不重播）。
          const state = computed(() => step().state);
          return (
          <View accessibilityLabel={`${step().label}：${SPOKEN[step().state]}`} class="min-h-6 flex-row items-center gap-3">
            <View class="size-6 items-center justify-center">
              {/* 状态一变就重建标记，新标记从 0.6 放大淡入。 */}
              {markFor(state())}
            </View>
            <Text
              class="text-sm transition-colors duration-120"
              classList={{
                "text-faint": step().state === "pending",
                "font-medium text-strong": step().state === "active",
                "text-foreground": step().state === "done",
                "text-destructive": step().state === "error",
              }}
            >
              {step().label}
            </Text>
          </View>
          );
        }}
      </Each>
    </View>
  );
}

function markFor(state: StepState) {
  switch (state) {
    case "pending":
      return <View class="size-1.5 rounded-full bg-faint" />;
    case "active":
      return <Spinner size="sm" label="进行中" />;
    case "done":
      return <Mark tone="done" />;
    case "error":
      return <Mark tone="error" />;
  }
}

function Mark(props: { tone: "done" | "error" }) {
  const m = createMotion({ enter: pop() });
  return (
    <View
      style={m.style}
      class="size-5 items-center justify-center rounded-full"
      classList={{ "bg-primary-tint": props.tone === "done", "bg-destructive-tint": props.tone === "error" }}
    >
      <Icon name={props.tone === "done" ? "check" : "cross"} size="sm" tone={props.tone === "done" ? "primary" : "destructive"} />
    </View>
  );
}

/** 编号说明步骤（未登录页的「怎么投稿」）：等宽数字在浅底圆里，和文字基线对齐。 */
export function OrderedSteps(props: { items: string[] }) {
  return (
    <View role="list" class="gap-3">
      <Each of={props.items}>
        {(item, index) => (
          <View accessibilityLabel={`第 ${index() + 1} 步：${item()}`} class="flex-row items-center gap-3">
            <View class="size-6 items-center justify-center rounded-full bg-muted">
              <Text class="font-mono text-xs text-muted-foreground">{index() + 1}</Text>
            </View>
            <Text class="flex-1 text-sm text-foreground">{item()}</Text>
          </View>
        )}
      </Each>
    </View>
  );
}
