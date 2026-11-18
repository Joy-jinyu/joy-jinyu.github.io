/** Markdown 正文：按博客文章页的层级给各部分配 token（标题 strong、正文 foreground、代码等宽浅底）。 */
import type { JSX } from "nsh";
import { View } from "nsh";
import { type MarkdownExtension, TextView } from "nsh/base";

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

/** ```mermaid 代码块变成自定义节点，交给 `renderDiagram` 画。 */
const DIAGRAMS: MarkdownExtension[] = [{ name: "mermaid", language: "mermaid" }];
const STREAMING = { streaming: true } as const;

export interface MarkdownProps {
  /** Markdown 原文。 */
  text: string;
  /** 文字还在流进来（AI 正在写）：没写完的语法按写完的样子显示，末尾有光标。 */
  streaming?: boolean;
  /** 画一张图（替换默认的图片显示）：调用方负责解析地址、载入和失败。 */
  renderImage?: (image: { src: string; alt?: string }) => JSX.Element;
  /** 给了它，```mermaid 代码块就交给它画（`code` 是代码本身）；不给就按普通代码块显示。 */
  renderDiagram?: (code: string) => JSX.Element;
  testID?: string;
}

/** 链接只报告不打开（预览里不跳走）。可以选中复制。 */
export function Markdown(props: MarkdownProps) {
  return (
    <TextView
      testID={props.testID}
      markdown={props.text}
      classes={CLASSES}
      links="report"
      selectable
      options={props.streaming ? STREAMING : undefined}
      streamingCaret={props.streaming ? <Caret /> : undefined}
      extensions={props.renderDiagram ? DIAGRAMS : undefined}
      renderCustom={props.renderDiagram ? (node) => props.renderDiagram!(node.text ?? "") : undefined}
      renderImage={props.renderImage ? (image) => props.renderImage!(image) : undefined}
    />
  );
}

/** 流式输出末尾的光标：品牌色细条慢呼吸（减少动效时静止）。 */
function Caret() {
  return <View accessibilityElementsHidden class="ml-0.5 h-4 w-1.5 rounded-sm bg-primary animate-pulse" />;
}
