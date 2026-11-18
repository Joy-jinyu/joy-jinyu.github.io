/** 稿件表单：标题、摘要、标签、正文（正文上方是 AI 工具和插入图片）。错误由写稿页决定什么时候显示。 */
import { Text, View } from "nsh";
import { type Draft, LIMITS } from "../../../src/lib/editor-host/contract";
import { Appear, Button, Card, Field, Notice, StepList, TagInput, TextArea, TextInput } from "../ui";
import { aiHintShown, aiRunning, type AiTool, startAi } from "./ai";
import { currentDraft, setField } from "./draft";
import { clearImageJobs, dismissImageNotice, imageJobs, imageNotice, imagesBusy, insertImages, noteBodyEdit, noteCaret } from "./images";

export interface DraftFormProps {
  /** 这个字段现在要显示的错误（碰过或尝试提交之后才有）。 */
  errorOf: (field: keyof Draft) => string | undefined;
  /** 用户离开了这个字段。 */
  touch: (field: keyof Draft) => void;
  /** 正文至少多高（pt），让它撑满可视区。 */
  bodyMinHeight: number;
}

export function DraftForm(props: DraftFormProps) {
  const draft = currentDraft;
  return (
    <View class="gap-5">
      <Field label="标题" count={draft().title.trim().length} max={LIMITS.title} error={props.errorOf("title")}>
        <TextInput
          testID="title"
          label="标题"
          value={draft().title}
          onChange={(v) => setField("title", v)}
          onBlur={() => props.touch("title")}
          invalid={!!props.errorOf("title")}
          placeholder="文章标题"
        />
      </Field>
      <Field label="一句话摘要" count={draft().description.trim().length} max={LIMITS.description} error={props.errorOf("description")}>
        <TextArea
          testID="description"
          label="一句话摘要"
          rows="short"
          value={draft().description}
          onChange={(v) => setField("description", v)}
          onBlur={() => props.touch("description")}
          invalid={!!props.errorOf("description")}
          placeholder="列表和分享卡片上显示的那一句"
        />
      </Field>
      <Field label="标签" error={props.errorOf("tags")} description={`回车或逗号添加，最多 ${LIMITS.tags} 个，每个不超过 ${LIMITS.tag} 字`}>
        <TagInput
          testID="tags"
          label="标签"
          tags={draft().tags}
          onChange={(tags) => setField("tags", tags)}
          onBlur={() => props.touch("tags")}
          max={LIMITS.tags}
          maxLength={LIMITS.tag}
          invalid={!!props.errorOf("tags")}
          placeholder="比如：前端、Rust"
        />
      </Field>
      <Field label="正文" error={props.errorOf("body")} actions={<BodyToolbar />}>
        <If when={aiHintShown()}>
          <Notice tone="warn" message="AI 还没设置：在站点顶栏的「AI 设置」里填好接口地址、模型和 key，保存后这里就能用。" />
        </If>
        <If when={imageNotice()}>{(message) => <Notice testID="image-notice" tone="warn" message={message()} onDismiss={dismissImageNotice} />}</If>
        <If when={imageJobs().length > 0}>
          <ImageProgress />
        </If>
        <TextArea
          testID="body"
          label="正文"
          rows="tall"
          minHeight={props.bodyMinHeight}
          value={draft().body}
          onChange={(v) => {
            setField("body", v);
            noteBodyEdit(v);
          }}
          onSelectionChange={noteCaret}
          onBlur={() => props.touch("body")}
          invalid={!!props.errorOf("body")}
          placeholder="用 Markdown 写正文。也可以先让 AI 起个稿。"
        />
      </Field>
    </View>
  );
}

/** 正文上方的工具：AI 起稿和插入图表随时可用，润色和起标题需要先有正文；最后是插入图片（不用 AI，没有 ✦）。 */
function BodyToolbar() {
  const empty = () => !currentDraft().body.trim();
  const tool = (kind: AiTool, label: string, needsBody: boolean) => (
    <Button
      testID={`ai-${kind}`}
      label={label}
      icon="sparkle"
      size="sm"
      variant="secondary"
      loading={aiRunning() === kind}
      disabled={needsBody && empty()}
      onPress={() => void startAi(kind)}
    />
  );
  return (
    <View role="toolbar" accessibilityLabel="正文工具" class="flex-row flex-wrap gap-2">
      {tool("draft", "AI 起稿…", false)}
      {tool("polish", "润色正文…", true)}
      {tool("meta", "起标题和摘要…", true)}
      {tool("chart", "插入图表…", false)}
      <Button testID="insert-image" label="插入图片…" size="sm" variant="secondary" loading={imagesBusy()} onPress={() => void insertImages()} />
    </View>
  );
}

/** 插入图片的进度：每张一行；全部成功就自己收起（正文里已经能看到），有失败的留着，可关闭。 */
function ImageProgress() {
  const done = () => imageJobs().filter((j) => j.state === "done").length;
  return (
    <Appear kind="panel">
      <Card testID="image-progress" padding="md">
        <View class="flex-row items-center gap-3">
          <Text class="flex-1 text-sm font-semibold text-strong">
            {imagesBusy() ? `正在插入图片（${done()} / ${imageJobs().length}）` : "有图片没能插入"}
          </Text>
          <If when={!imagesBusy()}>
            <Button label="关闭" size="sm" variant="ghost" onPress={clearImageJobs} />
          </If>
        </View>
        <StepList
          steps={imageJobs().map((j) => ({ id: String(j.id), label: j.message ? `${j.name}：${j.message}` : j.name, state: j.state }))}
        />
      </Card>
    </Appear>
  );
}
