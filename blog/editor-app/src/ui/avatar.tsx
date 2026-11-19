/** 头像：图片加载前和失败时显示名字的首字母。 */
import { Avatar as BaseAvatar } from "nsh/base";
import { tip } from "./tooltip";

/** `label`：旁边没写名字时给（窄屏顶栏只剩头像），读屏念它、悬停提示显示它；不给时头像是装饰，读屏跳过。 */
export function Avatar(props: { src?: string; name: string; size?: "sm" | "md"; label?: string }) {
  return (
    <BaseAvatar
      src={props.src || null}
      name={props.name}
      accessibilityLabel={props.label ?? ""}
      tooltip={props.label ? tip(props.label) : undefined}
      class="overflow-hidden rounded-full border border-border bg-muted"
      classList={{ "size-6": props.size === "sm", "size-8": props.size !== "sm" }}
      imageClass="size-full transition-opacity duration-240"
      fallbackClass="items-center justify-center text-xs font-medium text-muted-foreground"
    />
  );
}
