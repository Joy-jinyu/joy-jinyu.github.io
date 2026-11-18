/** 写稿页顶栏：谁在写、AI 状态、我的投稿、退出。 */
import { signal, Text, View } from "nsh";
import { Avatar, Button, StatusChip } from "../ui";
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
    <View role="toolbar" class="flex-row items-center gap-3 border-b border-border px-5 py-2.5">
      <View class="min-w-0 flex-1 flex-row items-center gap-2">
        <Avatar src={currentLogin()?.avatarUrl} name={currentLogin()?.login ?? ""} size="sm" />
        <Text style={{ numberOfLines: 1 }} class="min-w-0 flex-1 text-sm font-medium text-strong">
          {currentLogin()?.login ?? ""}
        </Text>
      </View>
      <View class="flex-row items-center gap-2">
        <AiChip />
        <Button testID="open-mine" label="我的投稿" size="sm" variant="secondary" onPress={props.onOpenMine} />
        <Button testID="logout" label="退出" size="sm" variant="ghost" loading={leaving()} onPress={() => void leave()} />
      </View>
    </View>
  );
}

/** AI 状态：设置好了显示模型名，没设置或读取失败时提醒；按下打开站点的 AI 设置（读取失败时重读）。 */
function AiChip() {
  const settings = () =>
    openAiSettings().catch((e: unknown) => {
      showNotice(`没能打开 AI 设置：${messageOf(e)}`);
    });
  const status = aiStatus;
  return (
    <If
      when={!aiStatusError()}
      else={<StatusChip testID="ai-chip" label="AI 状态读取失败" tone="warn" accessibilityLabel="AI 状态读取失败，重试" onPress={() => void loadAi()} />}
    >
      <StatusChip
        testID="ai-chip"
        loading={status() === undefined}
        label={status()?.configured ? (status() as { model: string }).model : status() ? "AI 未设置" : "AI"}
        mono={!!status()?.configured}
        tone={status()?.configured ? "ok" : "warn"}
        accessibilityLabel={status()?.configured ? `AI：${(status() as { model: string }).model}，打开 AI 设置` : "AI 未设置，打开 AI 设置"}
        onPress={() => void settings()}
      />
    </If>
  );
}
