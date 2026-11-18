/** 我的投稿：侧栏里列出 contrib.mine 的 PR，按下在新标签页打开。每次打开都重新读。 */
import { computed, List, resource, signal, Text, untracked, View } from "nsh";
import type { MyPr } from "../../host-contract";
import { Appear, Badge, type BadgeTone, Button, Empty, Notice, RowButton, Sheet, Skeleton, wave } from "../ui";
import { call, messageOf } from "./host";

const STATE: Record<MyPr["state"], { label: string; tone: BadgeTone }> = {
  open: { label: "审核中", tone: "warn" },
  merged: { label: "已发布", tone: "brand" },
  closed: { label: "已关闭", tone: "neutral" },
};

export function MySubmissions(props: { open: boolean; onClose: () => void }) {
  return (
    <Sheet testID="mine-sheet" open={props.open} onClose={props.onClose} title="我的投稿">
      <MineList />
    </Sheet>
  );
}

/** Sheet 每次打开都重新创建内容，所以每次打开都会读一遍。 */
function MineList() {
  const list = resource(() => call("contrib.mine", null));
  const openError = signal<string | null>(null);
  const show = computed<"loading" | "error" | "empty" | "list">(() => {
    if (list.error() && !list()) return "error";
    if (list() === undefined) return "loading";
    return list()!.length ? "list" : "empty";
  });
  const open = async (pr: MyPr) => {
    openError.set(null);
    try {
      await call("site.open", { url: pr.url });
    } catch (e) {
      openError.set(`没能打开：${messageOf(e)}`);
    }
  };
  return (
    <View class="min-h-0 flex-1 gap-3">
      <If when={openError()}>
        {(message) => (
          <View class="px-5">
            <Notice tone="danger" message={message()} onDismiss={() => openError.set(null)} />
          </View>
        )}
      </If>
      {show() === "loading" ? (
        <View testID="mine-loading" accessibilityLabel="正在读取我的投稿" class="gap-5 px-5 pt-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : show() === "error" ? (
        <Empty
          testID="mine-error"
          title="没能读取投稿"
          description={messageOf(list.error())}
          action={<Button label="重试" variant="secondary" onPress={list.refetch} />}
        />
      ) : show() === "empty" ? (
        <Empty testID="mine-empty" title="还没有投稿" description="提交过的稿件会以 PR 的形式列在这里。" />
      ) : (
        <List each={list() ?? []} keyExtractor={(pr) => String(pr.number)} estimatedItemSize={64} class="flex-1" contentClass="px-2 pb-4">
          {(pr, index) => {
            // 每次打开播一次波浪：前 10 行依次错开，之后的行（滚动进来的）直接出现。
            const delay = Math.min(untracked(index), wave.cap) * wave.gap;
            return (
              <Appear kind="panel" delay={delay}>
                <RowButton
                  testID={`mine-${pr().number}`}
                  role="link"
                  title={pr().title}
                  accessibilityLabel={`${pr().title}，${STATE[pr().state].label}，在 GitHub 打开`}
                  trailing="external"
                  onPress={() => void open(pr())}
                  meta={
                    <View class="flex-row items-center gap-2">
                      <Badge label={STATE[pr().state].label} tone={STATE[pr().state].tone} />
                      <Text class="font-mono text-xs text-muted-foreground">{`#${pr().number} · 更新于 ${day(pr().updatedAt)}`}</Text>
                    </View>
                  }
                />
              </Appear>
            );
          }}
        </List>
      )}
    </View>
  );
}

function SkeletonRow() {
  return (
    <View class="gap-2">
      <Skeleton shape="line" />
      <Skeleton shape="short" />
    </View>
  );
}

/** ISO 时间 → 本地日期 YYYY-MM-DD；解析不了就原样显示。 */
function day(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
