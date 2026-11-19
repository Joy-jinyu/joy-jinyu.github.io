/** 写稿页：顶栏、表单和预览（宽屏左右两栏，窄屏分段切换）、底部操作栏，以及它打开的对话框和侧栏。 */
import { computed, effect, Scroll, signal, Text, untracked, View, windowSize } from "nsh";
import type { Draft } from "../../../src/lib/editor-host/contract";
import { Appear, Button, Card, compact, confirm, gutter, Notice, Segmented, WIDE } from "../ui";
import { followAiDeltas } from "./ai";
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
  followAiDeltas();
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

  const clear = async () => {
    const ok = await confirm({ title: "清空这篇稿件？", description: "标题、摘要、标签和正文都会删掉，不能撤销。", confirmLabel: "清空", destructive: true });
    if (!ok) return;
    await clearDraft();
    touched.set({});
  };

  // 留白：宽屏两栏上下左右和栏间距都是 24（左栏右边 12 + 右栏左边 12），表单正文框和预览卡片的底对齐；
  // 窄屏单栏用页面边距（compact 时 16，否则 24），上边紧接分段控件那一条（它自己有 12 的下边距）。留白放在滚动区里面，输入框的焦点环不会被裁掉。
  const formPad = () => (wide() ? "pb-6 pl-6 pr-3 pt-6" : compact() ? "px-4 pb-4 pt-3" : "px-6 pb-6 pt-3");
  // 窄屏内容滚到分段控件那一条下面时，条底画一条细线。
  const scrolledUnder = signal(false);
  // 宽窄切换会换掉滚动区，新的从顶上开始：分隔线也回到没滚过的样子
  effect(() => {
    wide();
    untracked(() => scrolledUnder.set(false));
  });
  const followScroll = ({ offset }: { offset: { y: number } }) => {
    const under = offset.y > 0;
    if (under !== scrolledUnder()) scrolledUnder.set(under);
  };
  const form = () => (
    <Scroll class="flex-1" contentClass={`grow ${formPad()}`} onScroll={followScroll}>
      <DraftForm errorOf={errorOf} touch={touch} />
    </Scroll>
  );
  const preview = () => (
    <Scroll class="flex-1" contentClass={wide() ? "p-6" : formPad()} onScroll={followScroll}>
      <Preview />
    </Scroll>
  );

  return (
    <Appear kind="page" class="flex-1">
      <TopBar onOpenMine={() => mineOpen.set(true)} />
      <If when={currentNotice()}>
        {(message) => (
          <View class="pt-3" classList={gutter()}>
            <Notice tone="danger" message={message()} onDismiss={dismissNotice} />
          </View>
        )}
      </If>
      <If
        when={wide()}
        else={
          <View class="min-h-0 flex-1">
            {/* 不透明的整条，内容从它下面滚过、在条底被裁掉，不会从控件四周透出来。 */}
            <View
              class="border-b bg-background pb-3 pt-4 transition-colors duration-120 motion-reduce:transition-none"
              classList={{ ...gutter(), "border-border": scrolledUnder(), "border-transparent": !scrolledUnder() }}
            >
              <Segmented
                label="编辑或预览"
                value={view()}
                options={[
                  { value: "edit", label: "编辑" },
                  { value: "preview", label: "预览" },
                ]}
                onChange={(next) => {
                  view.set(next);
                  scrolledUnder.set(false);
                }}
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
          <View class="min-w-0 flex-1 pb-6 pl-3 pr-6 pt-6">
            <Card padding="none" class="flex-1">
              {preview()}
            </Card>
          </View>
        </View>
      </If>
      {/* 「清空…」在最前，保存状态跟在后面：状态出现、消失都不挪动按钮。 */}
      <View class="flex-row flex-wrap items-center gap-3 border-t border-border py-3" classList={gutter()}>
        <Button label="清空…" size="sm" variant="ghost" edge="start" disabled={isBlank(currentDraft())} onPress={() => void clear()} />
        <SaveState />
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
    <View>
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
