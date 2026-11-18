/** 头像：图片加载前和失败时显示名字的首字母。 */
import { Avatar as BaseAvatar } from "nsh/base";

export function Avatar(props: { src?: string; name: string; size?: "sm" | "md" }) {
  return (
    <BaseAvatar
      src={props.src || null}
      name={props.name}
      accessibilityLabel=""
      class="overflow-hidden rounded-full border border-border bg-muted"
      classList={{ "size-6": props.size === "sm", "size-8": props.size !== "sm" }}
      imageClass="size-full transition-opacity duration-240"
      fallbackClass="items-center justify-center text-xs font-medium text-muted-foreground"
    />
  );
}
