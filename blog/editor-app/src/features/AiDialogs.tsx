/** AI 的对话框：起稿（先填主题）、润色正文、起标题和摘要（打开就开始跑）、插入图表。生成过程流式显示，可以停；关掉对话框就放弃这次结果。 */
import { effect, signal, Text, untracked, View } from "nsh";
import type { AiResult, Draft } from "../../../src/lib/editor-host/contract";
import { Appear, Badge, Button, confirm, Dialog, Field, Notice, Separator, TextArea, TextInput } from "../ui";
import { aiOpen, closeAi, runAi, stopAi } from "./ai";
import { AiStream } from "./AiStream";
import { ChartDialog } from "./ChartDialog";
import { currentDraft, isBlank, replaceDraft, setField } from "./draft";
import { BodyMarkdown } from "./media";

export function AiDialogs() {
  return (
    <>
      <DraftDialog />
      <PolishDialog />
      <MetaDialog />
      <ChartDialog />
    </>
  );
}

type Phase = "input" | "running" | "done" | "error" | "stopped";

/** 生成中的底部操作：只有「停止」。 */
function StopButton(props: { onStop: () => void }) {
  return <Button testID="ai-stop" label="停止" variant="secondary" onPress={props.onStop} />;
}

/** AI 起稿：主题或提纲 + 额外要求 → 边写边看 → 整篇稿子的预览 → 填入稿件。 */
function DraftDialog() {
  const open = () => aiOpen() === "draft";
  const topic = signal("");
  const extra = signal("");
  const phase = signal<Phase>("input");
  const result = signal<Draft | null>(null);
  const error = signal("");
  // 每次打开从输入开始，上次填的主题留着。
  effect(() => {
    if (open()) untracked(() => phase.set("input"));
  });

  const generate = () => {
    if (!topic().trim() || phase() === "running") return;
    phase.set("running");
    runAi(
      { task: "draft", input: topic().trim(), extra: extra().trim() || undefined },
      (draft) => {
        result.set(draft);
        phase.set("done");
      },
      (message) => {
        error.set(message);
        phase.set("error");
      },
    );
  };
  const stop = () => {
    stopAi();
    phase.set("input");
  };
  const fill = async () => {
    const draft = result();
    if (!draft) return;
    if (!isBlank(currentDraft())) {
      const ok = await confirm({
        title: "用 AI 的稿子替换当前稿件？",
        description: "标题、摘要、标签和正文都会换掉，当前内容不会保留。",
        confirmLabel: "替换",
        destructive: true,
      });
      if (!ok) return;
    }
    replaceDraft(draft);
    closeAi();
  };

  return (
    <Dialog
      testID="ai-draft-dialog"
      open={open()}
      onClose={closeAi}
      title="AI 起稿"
      description="写下主题或提纲，AI 会写出整篇稿子，填入前可以先看一遍。"
      width={phase() === "running" || phase() === "done" ? "lg" : "md"}
      follow={phase() === "running"}
      onShortcut={phase() === "done" ? () => void fill() : phase() === "running" ? undefined : generate}
      footer={
        phase() === "done" ? (
          <>
            <Button label="改提纲" variant="ghost" onPress={() => phase.set("input")} />
            <Button label="重新生成" variant="secondary" onPress={generate} />
            <Button testID="ai-fill" label="填入稿件" variant="primary" onPress={() => void fill()} />
          </>
        ) : phase() === "running" ? (
          <StopButton onStop={stop} />
        ) : (
          <>
            <Button label="取消" variant="secondary" onPress={closeAi} />
            <Button testID="ai-generate" label="生成" variant="primary" disabled={!topic().trim()} onPress={generate} />
          </>
        )
      }
    >
      {phase() === "done" && result() ? (
        <Appear kind="panel">
          <DraftPreview draft={result()!} />
        </Appear>
      ) : phase() === "running" ? (
        <Appear kind="panel">
          <AiStream hint="通常要半分钟左右。按「停止」或关掉对话框都会放弃这次生成。" />
        </Appear>
      ) : (
        <View class="gap-4">
          <Field label="主题或提纲">
            <TextArea
              testID="ai-topic"
              label="主题或提纲"
              rows="medium"
              value={topic()}
              onChange={(v) => topic.set(v)}
              autoFocus
              placeholder="比如：为什么我们把前端构建从 webpack 换成了 Rspack，踩了哪些坑"
            />
          </Field>
          <Field label="额外要求" description="可以不填">
            <TextInput
              testID="ai-extra"
              label="额外要求"
              value={extra()}
              onChange={(v) => extra.set(v)}
              onSubmit={generate}
              placeholder="篇幅、语气，比如：2000 字左右，口语一点"
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

/** AI 起稿结果的预览：和写稿页的预览同一层级。 */
function DraftPreview(props: { draft: Draft }) {
  return (
    <View testID="ai-draft-result" class="gap-3">
      <Text role="header" class="text-lg font-semibold text-strong">
        {props.draft.title}
      </Text>
      <If when={props.draft.description}>
        <Text class="text-sm text-muted-foreground">{props.draft.description}</Text>
      </If>
      <If when={props.draft.tags.length > 0}>
        <View class="flex-row flex-wrap gap-1.5">
          <Each of={props.draft.tags}>{(tag) => <Badge label={tag()} tone="brand" />}</Each>
        </View>
      </If>
      <Separator />
      <BodyMarkdown text={props.draft.body} />
    </View>
  );
}

/** 「已停止」：停掉之后的说明，可以重新生成。 */
function Stopped(props: { message: string }) {
  return (
    <Appear kind="label">
      <Text testID="ai-stopped" class="py-6 text-sm text-muted-foreground">
        {props.message}
      </Text>
    </Appear>
  );
}

/** 润色正文：打开就跑，边写边看，结果整篇预览，「替换正文」才写回。 */
function PolishDialog() {
  const open = () => aiOpen() === "polish";
  const phase = signal<Phase>("running");
  const body = signal("");
  const error = signal("");
  const start = () => {
    phase.set("running");
    runAi(
      { task: "polish", input: currentDraft().body },
      (r: AiResult["polish"]) => {
        body.set(r.body);
        phase.set("done");
      },
      (message) => {
        error.set(message);
        phase.set("error");
      },
    );
  };
  effect(() => {
    if (open()) untracked(start);
  });
  const stop = () => {
    stopAi();
    phase.set("stopped");
  };
  const apply = () => {
    setField("body", body());
    closeAi();
  };
  return (
    <Dialog
      testID="ai-polish-dialog"
      open={open()}
      onClose={closeAi}
      title="润色正文"
      description="只改表达，不改意思。看过再决定要不要替换。"
      width={phase() === "running" || phase() === "done" ? "lg" : "md"}
      follow={phase() === "running"}
      onShortcut={phase() === "done" ? apply : undefined}
      footer={
        phase() === "running" ? (
          <StopButton onStop={stop} />
        ) : (
          <>
            <Button label="取消" variant="secondary" onPress={closeAi} />
            {phase() === "error" ? (
              <Button label="重试" variant="primary" onPress={start} />
            ) : phase() === "stopped" ? (
              <Button label="重新生成" variant="primary" onPress={start} />
            ) : (
              <Button testID="ai-apply-polish" label="替换正文" variant="primary" onPress={apply} />
            )}
          </>
        )
      }
    >
      {phase() === "running" ? (
        <AiStream hint="正文越长越久，通常一分钟以内。按「停止」或关掉对话框都会放弃这次润色。" />
      ) : phase() === "error" ? (
        <Notice tone="danger" message={error()} />
      ) : phase() === "stopped" ? (
        <Stopped message="已停止，正文没有改动。" />
      ) : (
        <Appear kind="panel">
          <BodyMarkdown testID="ai-polish-result" text={body()} />
        </Appear>
      )}
    </Dialog>
  );
}

/** 起标题和摘要：3 个标题选一个、一句摘要、一组标签，各自「采用」。采用过的显示「已采用」。 */
function MetaDialog() {
  const open = () => aiOpen() === "meta";
  const phase = signal<Phase>("running");
  const meta = signal<AiResult["meta"] | null>(null);
  const error = signal("");
  const start = () => {
    phase.set("running");
    runAi(
      { task: "meta", input: currentDraft().body },
      (r) => {
        meta.set(r);
        phase.set("done");
      },
      (message) => {
        error.set(message);
        phase.set("error");
      },
    );
  };
  effect(() => {
    if (open()) untracked(start);
  });
  const stop = () => {
    stopAi();
    phase.set("stopped");
  };
  const sameTags = (tags: string[]) => tags.join("\n") === currentDraft().tags.join("\n");
  return (
    <Dialog
      testID="ai-meta-dialog"
      open={open()}
      onClose={closeAi}
      title="起标题和摘要"
      description="根据正文给出几个备选，挑合适的采用。"
      follow={phase() === "running"}
      onShortcut={phase() === "running" ? undefined : closeAi}
      footer={
        phase() === "running" ? (
          <StopButton onStop={stop} />
        ) : (
          <>
            <Button label={phase() === "done" ? "完成" : "取消"} variant={phase() === "done" ? "primary" : "secondary"} onPress={closeAi} />
            <If when={phase() === "error"}>
              <Button label="重试" variant="primary" onPress={start} />
            </If>
            <If when={phase() === "stopped"}>
              <Button label="重新生成" variant="primary" onPress={start} />
            </If>
          </>
        )
      }
    >
      {phase() === "running" ? (
        <AiStream hint="通常十几秒。按「停止」或关掉对话框都会放弃这次生成。" />
      ) : phase() === "error" ? (
        <Notice tone="danger" message={error()} />
      ) : phase() === "stopped" ? (
        <Stopped message="已停止，标题和摘要没有改动。" />
      ) : (
        <Appear kind="panel" class="gap-5">
          <Field label="标题">
            <View class="gap-2">
              <Each of={meta()?.titles ?? []}>
                {(title, index) => (
                  <Choice
                    testID={`ai-title-${index()}`}
                    text={title()}
                    adopted={currentDraft().title === title()}
                    onAdopt={() => setField("title", title())}
                  />
                )}
              </Each>
            </View>
          </Field>
          <If when={meta()?.description}>
            <Field label="摘要">
              <Choice
                testID="ai-description"
                text={meta()!.description}
                adopted={currentDraft().description === meta()!.description}
                onAdopt={() => setField("description", meta()!.description)}
              />
            </Field>
          </If>
          <If when={(meta()?.tags.length ?? 0) > 0}>
            <Field label="标签">
              <View class="flex-row items-center gap-3">
                <View class="flex-1 flex-row flex-wrap gap-1.5">
                  <Each of={meta()?.tags ?? []}>{(tag) => <Badge label={tag()} tone="brand" />}</Each>
                </View>
                <AdoptButton testID="ai-tags" adopted={sameTags(meta()!.tags)} onAdopt={() => setField("tags", meta()!.tags)} />
              </View>
            </Field>
          </If>
        </Appear>
      )}
    </Dialog>
  );
}

/** 一个备选：文字 + 采用按钮。 */
function Choice(props: { text: string; adopted: boolean; onAdopt: () => void; testID?: string }) {
  return (
    <View class="flex-row items-center gap-3">
      <Text class="flex-1 text-sm text-strong">{props.text}</Text>
      <AdoptButton testID={props.testID} adopted={props.adopted} onAdopt={props.onAdopt} />
    </View>
  );
}

/** 「采用」↔「已采用」：采用后换成带勾的不可按状态，文字淡入上浮。 */
function AdoptButton(props: { adopted: boolean; onAdopt: () => void; testID?: string }) {
  return (
    <>
      {props.adopted ? (
        <Appear kind="label">
          <Button testID={props.testID} label="已采用" icon="check" size="sm" variant="ghost" disabled />
        </Appear>
      ) : (
        <Button testID={props.testID} label="采用" size="sm" variant="secondary" onPress={props.onAdopt} />
      )}
    </>
  );
}
