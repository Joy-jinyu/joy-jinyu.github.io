/** AI 生成过程：阶段行（思考中 / 写作中 / 整理中 + 秒数）、可折叠的思考过程、正在写出的内容。四个 AI 对话框共用。 */
import { signal, Text, View } from "nsh";
import { Appear, Disclosure, Markdown, Spinner } from "../ui";
import { type AiKind, type AiStage, aiContent, aiElapsed, aiReasoning, aiStage, aiStreamKind } from "./ai";

const STAGE: Record<AiStage, string> = { thinking: "思考中", writing: "写作中", finishing: "整理中" };

/** `hint`：内容出来之前显示的一句说明（要多久、怎么放弃）。 */
export function AiStream(props: { hint: string }) {
  // 用户按过「思考过程」就按用户的来；没按过：正文出来之前展开，出来之后收起。
  const userOpen = signal<boolean | null>(null);
  const thinkingOpen = () => userOpen() ?? !aiContent();
  return (
    <View testID="ai-stream" class="gap-4">
      <StageLine />
      <If when={aiReasoning()}>
        <Appear kind="label">
          <Disclosure
            testID="ai-reasoning"
            label="思考过程"
            meta={`${aiReasoning().length} 字`}
            open={thinkingOpen()}
            onToggle={() => userOpen.set(!thinkingOpen())}
          >
            <Text testID="ai-reasoning-text" class="text-xs leading-5 text-muted-foreground">
              {aiReasoning()}
            </Text>
          </Disclosure>
        </Appear>
      </If>
      <If when={aiContent()} else={<Text class="text-xs text-muted-foreground">{props.hint}</Text>}>
        <Appear kind="label" class="gap-2">
          <Text class="text-xs font-semibold text-muted-foreground">正在写</Text>
          <Markdown testID="ai-stream-content" streaming text={readable(aiStreamKind(), aiContent())} />
        </Appear>
      </If>
    </View>
  );
}

/** 阶段一变，文字重建并上浮淡入；秒数原地走。 */
function StageLine() {
  return (
    <View class="min-h-6 flex-row items-center gap-2">
      <Spinner size="sm" label={aiStage() ? STAGE[aiStage()!] : "生成中"} />
      {aiStage() ? (
        <Appear kind="label" testID="ai-stage">
          <Text class="text-sm font-medium text-strong">
            {STAGE[aiStage()!]}
          </Text>
        </Appear>
      ) : null}
      <Text class="font-mono text-xs tabular-nums text-muted-foreground">{`${aiElapsed()} 秒`}</Text>
    </View>
  );
}

/** 去掉开头的代码块标记（模型有时会加上）。 */
const stripFence = (text: string) => text.replace(/^\s*```[\w-]*[ \t]*\n?/, "");

/** 原始的流式内容换成好读的 Markdown（只为显示，结果以宿主整理好的为准）。 */
function readable(kind: AiKind | null, content: string): string {
  switch (kind) {
    case "draft":
      return draftHead(content);
    case "meta":
      // 「标题：…」逐行输出：一行一段，不挤成一段。
      return content
        .split("\n")
        .filter((line) => line.trim())
        .join("\n\n");
    case "diagram":
      return `\`\`\`mermaid\n${stripFence(content)}`;
    case "svg":
      return `\`\`\`xml\n${stripFence(content)}`;
    default:
      return content;
  }
}

/**
 * 起稿的原始输出是「标题：… / 摘要：… / 标签：…」三行、`---`、正文。三行各成一段，`---` 前空一行：
 * 不然 Markdown 会把紧贴着的 `---` 读成上面三行的标题下划线。没按格式写（前几行里没有 `---`）就原样显示。
 */
function draftHead(content: string): string {
  const lines = content.split("\n");
  const sep = lines.findIndex((line) => line.trim() === "---");
  if (sep < 0) return lines.length > 4 ? content : lines.filter((line) => line.trim()).join("\n\n");
  if (sep > 4) return content;
  const head = lines.slice(0, sep).filter((line) => line.trim()).join("\n\n");
  return `${head}\n\n---\n\n${lines.slice(sep + 1).join("\n")}`;
}
