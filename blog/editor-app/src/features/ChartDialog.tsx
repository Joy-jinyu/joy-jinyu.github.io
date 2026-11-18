/** 插入图表：描述想画什么，选 Mermaid 图或 SVG 插图 → 边写边看 → 看图 → 插入正文末尾。 */
import { effect, signal, Text, untracked, View } from "nsh";
import { type AiResult, LIMITS } from "../../../src/lib/editor-host/contract";
import { Appear, Button, Dialog, Field, Figure, Notice, Segmented, TextArea, TextInput } from "../ui";
import { aiOpen, closeAi, runAi, stopAi } from "./ai";
import { AiStream } from "./AiStream";
import { currentDraft, insertBlock, setField } from "./draft";
import { countImages } from "./images";
import { Diagram } from "./media";

type Mode = "diagram" | "svg";
type Phase = "input" | "running" | "done" | "error";
type Chart = { kind: "diagram"; mermaid: string } | { kind: "svg"; image: AiResult["svg"]["image"] };

const MODES: { value: Mode; label: string }[] = [
  { value: "diagram", label: "Mermaid 图" },
  { value: "svg", label: "SVG 插图" },
];
const MODE_HINT: Record<Mode, string> = {
  diagram: "流程图、时序图、饼图、折线 / 柱状图，AI 按内容挑；正文里存的是代码，以后还能改。",
  svg: "一张插图，存成图片放进正文。",
};

export function ChartDialog() {
  const open = () => aiOpen() === "chart";
  const subject = signal("");
  const extra = signal("");
  const mode = signal<Mode>("diagram");
  const phase = signal<Phase>("input");
  const chart = signal<Chart | null>(null);
  const error = signal("");
  const insertError = signal<string | null>(null);
  // 每次打开从输入开始，上次填的描述留着。
  effect(() => {
    if (open()) untracked(() => phase.set("input"));
  });

  const generate = () => {
    if (!subject().trim() || phase() === "running") return;
    phase.set("running");
    insertError.set(null);
    const task = { input: subject().trim(), extra: extra().trim() || undefined };
    const failed = (message: string) => {
      error.set(message);
      phase.set("error");
    };
    const done = (next: Chart) => {
      chart.set(next);
      phase.set("done");
    };
    if (mode() === "diagram") runAi({ task: "diagram", ...task }, (r) => done({ kind: "diagram", mermaid: r.mermaid }), failed);
    else runAi({ task: "svg", ...task }, (r) => done({ kind: "svg", image: r.image }), failed);
  };
  const stop = () => {
    stopAi();
    phase.set("input");
  };
  const insert = () => {
    const c = chart();
    if (!c) return;
    const body = currentDraft().body;
    if (c.kind === "svg" && !body.includes(c.image.path) && countImages(body) >= LIMITS.images) {
      insertError.set(`正文里已经有 ${LIMITS.images} 张图片，最多放 ${LIMITS.images} 张。删掉一张再插入。`);
      return;
    }
    const block = c.kind === "diagram" ? `\`\`\`mermaid\n${c.mermaid}\n\`\`\`` : `![图](${c.image.path})`;
    setField("body", insertBlock(body, body.length, block).body);
    closeAi();
  };

  return (
    <Dialog
      testID="ai-chart-dialog"
      open={open()}
      onClose={closeAi}
      title="插入图表"
      description="描述想画什么，AI 画好后先看一眼，再插到正文末尾。"
      follow={phase() === "running"}
      onShortcut={phase() === "done" ? insert : phase() === "running" ? undefined : generate}
      footer={
        phase() === "done" ? (
          <>
            <Button label="取消" variant="ghost" onPress={closeAi} />
            <Button label="重新生成" variant="secondary" onPress={generate} />
            <Button testID="chart-insert" label="插入正文" variant="primary" onPress={insert} />
          </>
        ) : phase() === "running" ? (
          <Button testID="ai-stop" label="停止" variant="secondary" onPress={stop} />
        ) : (
          <>
            <Button label="取消" variant="secondary" onPress={closeAi} />
            <Button testID="chart-generate" label="生成" variant="primary" disabled={!subject().trim()} onPress={generate} />
          </>
        )
      }
    >
      {phase() === "done" && chart() ? (
        <Appear kind="panel" class="gap-3">
          <ChartPreview chart={chart()!} />
          <If when={insertError()}>{(message) => <Notice tone="warn" message={message()} />}</If>
        </Appear>
      ) : phase() === "running" ? (
        <Appear kind="panel">
          <AiStream hint="通常十几秒到半分钟。按「停止」或关掉对话框都会放弃这次生成。" />
        </Appear>
      ) : (
        <View class="gap-4">
          <Field label="想画什么">
            <TextArea
              testID="chart-subject"
              label="想画什么"
              rows="medium"
              value={subject()}
              onChange={(v) => subject.set(v)}
              autoFocus
              placeholder="比如：读者投稿从写稿、提交 PR 到审核发布的流程"
            />
          </Field>
          <Field label="类型" description={MODE_HINT[mode()]}>
            <Segmented label="图表类型" value={mode()} options={MODES} onChange={(next) => mode.set(next)} />
          </Field>
          <Field label="额外要求" description="可以不填">
            <TextInput
              testID="chart-extra"
              label="额外要求"
              value={extra()}
              onChange={(v) => extra.set(v)}
              onSubmit={generate}
              placeholder="比如：横向排布，不超过六步"
            />
          </Field>
          <If when={phase() === "error"}>
            <Notice tone="danger" message={error()} />
          </If>
        </View>
      )}
    </Dialog>
  );
}

/** 画好的图：Mermaid 交给宿主渲染（和预览里一样），SVG 直接显示宿主存好的图。 */
function ChartPreview(props: { chart: Chart }) {
  return (
    <View testID="chart-result" class="gap-2">
      <Text class="text-xs font-semibold text-muted-foreground">{props.chart.kind === "diagram" ? "Mermaid 图" : "SVG 插图"}</Text>
      {props.chart.kind === "diagram" ? (
        <Diagram testID="chart-diagram" code={props.chart.mermaid} />
      ) : (
        <Figure testID="chart-svg" src={props.chart.image.url} alt="图" />
      )}
    </View>
  );
}
