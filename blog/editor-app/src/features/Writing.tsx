/** 写稿页：顶栏、表单和预览（宽屏左右两栏，窄屏分段切换）、底部操作栏，以及它打开的对话框和侧栏。 */
import { computed, Scroll, signal, Text, View, windowSize } from "nsh";
import type { Draft } from "../../host-contract";
import { Appear, Button, Card, confirm, Notice, Segmented, WIDE } from "../ui";
import { AiDialogs } from "./AiDialogs";
import { DraftForm } from "./DraftForm";
import { clearDraft, currentDraft, draftSaveState, isBlank, validate } from "./draft";
import { MySubmissions } from "./MySubmissions";
import { currentNotice, dismissNotice } from "./notice";
import { Preview } from "./Preview";
import { SubmitDialog } from "./SubmitDialog";
import { followProgress, startSubmit } from "./submit";
import { TopBar } from "./TopBar";

type Mode = "edit" | "preview";

export function Writing() {
  followProgress();
  const wide = () => windowSize().width >= WIDE;
  const view = signal<Mode>("edit");
  const mineOpen = signal(false);
  const touched = signal<Partial<Record<keyof Draft, boolean>>>({});
  const errors = computed(() => validate(currentDraft()));
  const valid = () => Object.keys(errors()).length === 0;
  const errorOf = (field: keyof Draft) => (touched()[field] ? errors()[field] : undefined);
  const touch = (field: keyof Draft) => {
    if (!touched()[field]) touched.update((t) => ({ ...t, [field]: true }));
  };
  // 正文撑到可视区底部：窗口高度减去顶栏、上面三个字段、表单下边距和底栏（1280×860 截图量得：宽屏约 520，窄屏多一行分段控件约 590）。
  const bodyMinHeight = () => Math.max(320, windowSize().height - (wide() ? 520 : 590));

  const clear = async () => {
    const ok = await confirm({ title: "清空这篇稿件？", description: "标题、摘要、标签和正文都会删掉，不能撤销。", confirmLabel: "清空", destructive: true });
    if (!ok) return;
    await clearDraft();
    touched.set({});
  };

  const form = () => (
    <Scroll class="flex-1">
      <View class="p-5">
        <DraftForm errorOf={errorOf} touch={touch} bodyMinHeight={bodyMinHeight()} />
      </View>
    </Scroll>
  );
  const preview = () => (
    <Scroll class="flex-1">
      <View class="p-6">
        <Preview />
      </View>
    </Scroll>
  );

  return (
    <Appear kind="page" class="flex-1">
      <TopBar onOpenMine={() => mineOpen.set(true)} />
      <If when={currentNotice()}>
        {(message) => (
          <View class="px-5 pt-3">
            <Notice tone="danger" message={message()} onDismiss={dismissNotice} />
          </View>
        )}
      </If>
      <If
        when={wide()}
        else={
          <View class="min-h-0 flex-1">
            <View class="px-5 pt-4">
              <Segmented
                label="编辑或预览"
                value={view()}
                options={[
                  { value: "edit", label: "编辑" },
                  { value: "preview", label: "预览" },
                ]}
                onChange={(next) => view.set(next)}
              />
            </View>
            {/* 切换时重建内容区，新内容淡入；稿件在 store 里，不会丢。 */}
            {view() === "edit" ? (
              <Appear kind="label" class="min-h-0 flex-1">
                {form()}
              </Appear>
            ) : (
              <Appear kind="label" class="min-h-0 flex-1">
                {preview()}
              </Appear>
            )}
          </View>
        }
      >
        <View class="min-h-0 flex-1 flex-row">
          <View class="min-w-0 flex-1">{form()}</View>
          <View class="min-w-0 flex-1 py-5 pr-5">
            <Card padding="none" class="flex-1">
              {preview()}
            </Card>
          </View>
        </View>
      </If>
      <View class="flex-row flex-wrap items-center gap-3 border-t border-border px-5 py-3">
        <SaveState />
        <Button label="清空…" size="sm" variant="ghost" disabled={isBlank(currentDraft())} onPress={() => void clear()} />
        <View class="flex-1" />
        <If when={!valid() && wide()}>
          <Text class="text-xs text-muted-foreground">填好标题、摘要和正文后可以提交</Text>
        </If>
        <Button testID="submit" label="提交审核…" variant="primary" disabled={!valid()} onPress={() => void startSubmit()} />
      </View>
      <AiDialogs />
      <SubmitDialog />
      <MySubmissions open={mineOpen()} onClose={() => mineOpen.set(false)} />
    </Appear>
  );
}

/** 草稿保存状态：状态一变就重建文字，新文字淡入。 */
function SaveState() {
  const label = computed(() => {
    switch (draftSaveState()) {
      case "pending":
        return "保存中…";
      case "saved":
        return "草稿已保存";
      case "error":
        return "草稿没能保存到本机";
      default:
        return "";
    }
  });
  return (
    <View class="min-w-24">
      {label() ? (
        <Appear kind="label">
          <Text class="font-mono text-xs" classList={{ "text-muted-foreground": draftSaveState() !== "error", "text-destructive": draftSaveState() === "error" }}>
            {label()}
          </Text>
        </Appear>
      ) : null}
    </View>
  );
}
