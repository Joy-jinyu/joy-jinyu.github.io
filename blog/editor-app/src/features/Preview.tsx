/** 稿件预览：和文章页一样的层级，标题、摘要、标签、正文。 */
import { Text, View } from "nsh";
import { Badge, Markdown, Separator } from "../ui";
import { currentDraft } from "./draft";

export function Preview() {
  const draft = currentDraft;
  return (
    <View testID="preview" class="gap-4">
      <Text class="font-mono text-xs text-muted-foreground">预览</Text>
      <Text
        role="header"
        accessibilityLevel={1}
        class="text-2xl font-semibold"
        classList={{ "text-strong": !!draft().title.trim(), "text-faint": !draft().title.trim() }}
      >
        {draft().title.trim() || "未命名稿件"}
      </Text>
      <If when={draft().description.trim()}>
        <Text class="text-base text-muted-foreground">{draft().description.trim()}</Text>
      </If>
      <If when={draft().tags.length > 0}>
        <View class="flex-row flex-wrap gap-1.5">
          <Each of={draft().tags}>{(tag) => <Badge label={tag()} tone="brand" />}</Each>
        </View>
      </If>
      <Separator />
      <If when={draft().body.trim()} else={<Text class="text-sm text-faint">正文预览会显示在这里。</Text>}>
        <Markdown testID="preview-body" text={draft().body} />
      </If>
    </View>
  );
}
