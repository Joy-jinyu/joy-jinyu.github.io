/** AI 的三个对话框：起稿（先填主题）、润色正文、起标题和摘要（打开就开始跑）。关掉对话框就放弃这次结果。 */
import { effect, signal, Text, untracked, View } from "nsh";
import type { AiResult, Draft } from "../../host-contract";
import { Appear, Badge, Button, confirm, Dialog, Field, Markdown, Notice, Separator, Spinner, TextArea, TextInput } from "../ui";
import { aiOpen, aiRunning, closeAi, runAi } from "./ai";
import { currentDraft, isBlank, replaceDraft, setField } from "./draft";

export function AiDialogs() {
  return (
    <>
      <DraftDialog />
      <PolishDialog />
      <MetaDialog />
    </>
  );
}

type Phase = "input" | "running" | "done" | "error";

/** AI 起稿：主题或提纲 + 额外要求 → 整篇稿子的预览 → 填入稿件。 */
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
      width={phase() === "done" ? "lg" : "md"}
      onShortcut={phase() === "done" ? () => void fill() : generate}
      footer={
        phase() === "done" ? (
          <>
            <Button label="改提纲" variant="ghost" onPress={() => phase.set("input")} />
            <Button label="重新生成" variant="secondary" onPress={generate} />
            <Button testID="ai-fill" label="填入稿件" variant="primary" onPress={() => void fill()} />
          </>
        ) : (
          <>
            <Button label="取消" variant="secondary" onPress={closeAi} />
            <Button
              testID="ai-generate"
              label="生成"
              loadingLabel="生成中…"
              variant="primary"
              loading={phase() === "running"}
              disabled={!topic().trim()}
              onPress={generate}
            />
          </>
        )
      }
    >
      {phase() === "done" && result() ? (
        <Appear kind="panel">
          <DraftPreview draft={result()!} />
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
              readonly={phase() === "running"}
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
              readonly={phase() === "running"}
              onSubmit={generate}
              placeholder="篇幅、语气，比如：2000 字左右，口语一点"
            />
          </Field>
          <If when={phase() === "running"}>
            <Text class="text-xs text-muted-foreground">通常要半分钟左右。关掉对话框就会放弃这次生成。</Text>
          </If>
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
      <Markdown text={props.draft.body} />
    </View>
  );
}

/** 生成中：spinner 和一句说明。 */
function Working(props: { label: string }) {
  return (
    <View class="flex-row items-center gap-3 py-6">
      <Spinner label={props.label} />
      <Text class="text-sm text-muted-foreground">{props.label}</Text>
    </View>
  );
}

/** 润色正文：打开就跑，结果整篇预览，「替换正文」才写回。 */
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
      width={phase() === "done" ? "lg" : "md"}
      onShortcut={phase() === "done" ? apply : undefined}
      footer={
        <>
          <Button label="取消" variant="secondary" onPress={closeAi} />
          {phase() === "error" ? (
            <Button label="重试" variant="primary" onPress={start} />
          ) : (
            <Button testID="ai-apply-polish" label="替换正文" loadingLabel="润色中…" variant="primary" loading={aiRunning() === "polish"} onPress={apply} />
          )}
        </>
      }
    >
      {phase() === "running" ? (
        <Working label="正在润色正文…" />
      ) : phase() === "error" ? (
        <Notice tone="danger" message={error()} />
      ) : (
        <Appear kind="panel">
          <Markdown testID="ai-polish-result" text={body()} />
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
  const sameTags = (tags: string[]) => tags.join("\n") === currentDraft().tags.join("\n");
  return (
    <Dialog
      testID="ai-meta-dialog"
      open={open()}
      onClose={closeAi}
      title="起标题和摘要"
      description="根据正文给出几个备选，挑合适的采用。"
      onShortcut={closeAi}
      footer={
        <>
          <Button label={phase() === "done" ? "完成" : "取消"} variant={phase() === "done" ? "primary" : "secondary"} onPress={closeAi} />
          <If when={phase() === "error"}>
            <Button label="重试" variant="primary" onPress={start} />
          </If>
        </>
      }
    >
      {phase() === "running" ? (
        <Working label="正在起标题和摘要…" />
      ) : phase() === "error" ? (
        <Notice tone="danger" message={error()} />
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
