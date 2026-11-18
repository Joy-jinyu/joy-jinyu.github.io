/** 提交进度对话框：四步进度，成功给出 PR 编号和两个去处，失败可重试。进行中不能关。 */
import { signal, Text } from "nsh";
import { Appear, Button, Dialog, Notice, StepList } from "../ui";
import { clearDraft } from "./draft";
import { call, messageOf } from "./host";
import { closeSubmit, submit, submitError, submitOpen, submitResult, submitStatus, submitSteps } from "./submit";

const TITLES = { running: "正在提交", success: "已提交", error: "没能提交" } as const;

export function SubmitDialog() {
  const openError = signal<string | null>(null);
  const viewPr = async () => {
    const pr = submitResult();
    if (!pr) return;
    openError.set(null);
    try {
      await call("site.open", { url: pr.prUrl });
    } catch (e) {
      openError.set(`没能打开 PR：${messageOf(e)}`);
    }
  };
  const next = async () => {
    await clearDraft();
    closeSubmit();
  };
  return (
    <Dialog
      testID="submit-dialog"
      open={submitOpen()}
      onClose={closeSubmit}
      title={TITLES[submitStatus()]}
      dismissible={submitStatus() !== "running"}
      onShortcut={submitStatus() === "error" ? () => void submit() : undefined}
      footer={
        submitStatus() === "success" ? (
          <>
            <Button testID="view-pr" label="查看 PR" icon="external" variant="secondary" onPress={() => void viewPr()} />
            <Button testID="next-draft" label="继续写新稿" variant="primary" onPress={() => void next()} />
          </>
        ) : submitStatus() === "error" ? (
          <>
            <Button label="关闭" variant="secondary" onPress={closeSubmit} />
            <Button testID="retry-submit" label="重试" variant="primary" onPress={() => void submit()} />
          </>
        ) : null
      }
    >
      <StepList testID="submit-steps" steps={submitSteps()} />
      <If when={submitStatus() === "running"}>
        <Text class="text-xs text-muted-foreground">要和 GitHub 来回几次，通常十几秒。</Text>
      </If>
      <If when={submitResult()}>
        {(pr) => (
          <Appear kind="panel" class="gap-1">
            <Text class="text-sm text-strong">{`PR #${pr().prNumber} 已创建`}</Text>
            <Text class="text-sm text-muted-foreground">审过合并后会发布在「投稿」专栏，可以在「我的投稿」里看进度。</Text>
          </Appear>
        )}
      </If>
      <If when={submitError()}>{(message) => <Notice tone="danger" message={message()} />}</If>
      <If when={openError()}>{(message) => <Notice tone="danger" message={message()} />}</If>
    </Dialog>
  );
}
