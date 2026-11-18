/** Markdown 正文：按博客文章页的层级给各部分配 token（标题 strong、正文 foreground、代码等宽浅底）。 */
import { TextView } from "nsh/base";

const CLASSES = {
  root: "gap-4 text-base leading-7 text-foreground",
  heading1: "pt-2 text-2xl font-semibold text-strong",
  heading2: "pt-2 text-xl font-semibold text-strong",
  heading3: "text-lg font-semibold text-strong",
  heading4: "text-base font-semibold text-strong",
  strong: "font-semibold text-strong",
  link: "text-primary underline",
  code: "rounded-(--radius-sm) bg-muted px-1 font-mono text-sm text-strong",
  codeBlock: "rounded-(--radius) border border-border bg-muted",
  codeBlockCode: "font-mono text-sm leading-6 text-strong",
  blockquote: "border-l-2 border-border-strong pl-4 text-muted-foreground",
  listMarker: "text-muted-foreground",
  table: "rounded-(--radius-sm) border border-border",
} as const;

/** `text`：Markdown 原文。链接只报告不打开（预览里不跳走）。可以选中复制。 */
export function Markdown(props: { text: string; testID?: string }) {
  return <TextView testID={props.testID} markdown={props.text} classes={CLASSES} links="report" selectable />;
}
