/** 不确定时长的等待：一个转圈的环。减少动效时浏览器会停掉 animate-spin，状态要靠旁边的文字说明。 */
import { View } from "nsh";

/** `tone`：primary 用在普通表面上，on-primary 用在主按钮里，muted 用在次要按钮里。 */
export type SpinnerTone = "primary" | "on-primary" | "muted";

export function Spinner(props: { size?: "sm" | "md"; tone?: SpinnerTone; label?: string }) {
  return (
    <View
      role="progressbar"
      accessibilityLabel={props.label ?? "加载中"}
      class="rounded-full border-2 animate-spin"
      classList={{
        "size-3.5": props.size === "sm",
        "size-5": props.size !== "sm",
        "border-primary/25 border-t-primary": (props.tone ?? "primary") === "primary",
        "border-primary-foreground/30 border-t-primary-foreground": props.tone === "on-primary",
        "border-muted-foreground/25 border-t-muted-foreground": props.tone === "muted",
      }}
    />
  );
}
