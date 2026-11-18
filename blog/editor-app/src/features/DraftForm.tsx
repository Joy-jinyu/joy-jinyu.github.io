/** 稿件表单：标题、摘要、标签、正文（正文上方是 AI 工具）。错误由写稿页决定什么时候显示。 */
import { View } from "nsh";
import { type Draft, LIMITS } from "../../host-contract";
import { Button, Field, Notice, TagInput, TextArea, TextInput } from "../ui";
import { aiHintShown, aiRunning, type AiKind, startAi } from "./ai";
import { currentDraft, setField } from "./draft";

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
      <Field label="正文" error={props.errorOf("body")} actions={<AiToolbar />}>
        <If when={aiHintShown()}>
          <Notice tone="warn" message="AI 还没设置：在站点顶栏的「AI 设置」里填好接口地址、模型和 key，保存后这里就能用。" />
        </If>
        <TextArea
          testID="body"
          label="正文"
          rows="tall"
          minHeight={props.bodyMinHeight}
          value={draft().body}
          onChange={(v) => setField("body", v)}
          onBlur={() => props.touch("body")}
          invalid={!!props.errorOf("body")}
          placeholder="用 Markdown 写正文。也可以先让 AI 起个稿。"
        />
      </Field>
    </View>
  );
}

/** 正文上方的 AI 工具：起稿随时可用，润色和起标题需要先有正文。 */
function AiToolbar() {
  const empty = () => !currentDraft().body.trim();
  const tool = (kind: AiKind, label: string, needsBody: boolean) => (
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
    <View role="toolbar" accessibilityLabel="AI 工具" class="flex-row flex-wrap gap-2">
      {tool("draft", "AI 起稿…", false)}
      {tool("polish", "润色正文…", true)}
      {tool("meta", "起标题和摘要…", true)}
    </View>
  );
}
