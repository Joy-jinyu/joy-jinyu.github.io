/** 写稿页顶栏：谁在写、AI 状态、我的投稿、退出。右边三个控件同高（size bar）；窄屏只留头像，AI 只显示「AI」和状态点。 */
import { signal, Text, View } from "nsh";
import { Avatar, Button, compact, gutter, StatusChip } from "../ui";
import { messageOf } from "./host";
import { showNotice } from "./notice";
import { aiStatus, aiStatusError, currentLogin, loadAi, openAiSettings, signOut } from "./session";

export function TopBar(props: { onOpenMine: () => void }) {
  const leaving = signal(false);
  const leave = async () => {
    leaving.set(true);
    try {
      await signOut();
    } catch (e) {
      showNotice(`没能退出：${messageOf(e)}`);
    } finally {
      leaving.set(false);
    }
  };
  return (
    <View role="toolbar" class="flex-row items-center gap-3 border-b border-border py-2" classList={gutter()}>
      <View class="min-w-0 flex-1 flex-row items-center gap-2">
        <Avatar src={currentLogin()?.avatarUrl} name={currentLogin()?.login ?? ""} size="sm" label={compact() ? currentLogin()?.login : undefined} />
        <If when={!compact()}>
          <Text style={{ numberOfLines: 1 }} class="min-w-0 flex-1 text-sm font-medium text-strong">
            {currentLogin()?.login ?? ""}
          </Text>
        </If>
      </View>
      <View class="min-w-0 flex-row items-center gap-2">
        <AiChip />
        <Button testID="open-mine" label="我的投稿" size="bar" variant="secondary" onPress={props.onOpenMine} />
        <Button testID="logout" label="退出" size="bar" variant="ghost" loading={leaving()} onPress={() => void leave()} />
      </View>
    </View>
  );
}

/**
 * AI 状态按钮：设置好了是「AI · 模型名」（窄屏只有「AI」，模型名在读屏名和悬停提示里），没设置或读取失败时写明；
 * 按下打开站点的 AI 设置（读取失败时重读）。
 */
function AiChip() {
  const settings = () =>
    openAiSettings().catch((e: unknown) => {
      showNotice(`没能打开 AI 设置：${messageOf(e)}`);
    });
  const model = () => {
    const status = aiStatus();
    return status?.configured ? status.model : undefined;
  };
  return (
    <If
      when={!aiStatusError()}
      else={<StatusChip testID="ai-chip" label="AI 状态读取失败" tone="warn" accessibilityLabel="AI 状态读取失败，重试" onPress={() => void loadAi()} />}
    >
      <StatusChip
        testID="ai-chip"
        loading={aiStatus() === undefined}
        label={model() || !aiStatus() ? "AI" : "AI 未设置"}
        detail={compact() ? undefined : model()}
        tone={model() ? "ok" : "warn"}
        hint={model() ? `AI 模型：${model()}` : undefined}
        accessibilityLabel={model() ? `AI：${model()}，打开 AI 设置` : "AI 未设置，打开 AI 设置"}
        onPress={() => void settings()}
      />
    </If>
  );
}
