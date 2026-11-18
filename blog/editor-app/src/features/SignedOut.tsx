/** 未登录：说明投稿怎么走，一个「用 GitHub 登录」。 */
import { Scroll, signal, Text, View } from "nsh";
import { Appear, Button, Card, Notice, OrderedSteps } from "../ui";
import { messageOf } from "./host";
import { signIn } from "./session";

const STEPS = ["用 GitHub 登录", "写稿，可以让 AI 帮忙起稿和润色", "提交后会变成一个 PR，审过后发布"];

export function SignedOut() {
  const pending = signal(false);
  const error = signal<string | null>(null);
  const login = async () => {
    if (pending()) return;
    pending.set(true);
    error.set(null);
    try {
      if (!(await signIn())) error.set("登录没有完成，可以再试一次。");
    } catch (e) {
      error.set(messageOf(e));
    } finally {
      pending.set(false);
    }
  };
  return (
    <Scroll class="flex-1">
      <View class="min-h-full items-center justify-center p-6">
        <Appear kind="page" class="w-full max-w-md">
          <Card padding="lg">
            <View class="gap-2">
              <Text class="font-mono text-xs text-muted-foreground">PAIRWISE · 投稿</Text>
              <Text role="header" accessibilityLevel={1} class="text-2xl font-semibold text-strong">
                投稿到 Pairwise
              </Text>
              <Text class="text-sm text-muted-foreground">稿件会以 PR 的形式提交到博客仓库，审过后发布在「投稿」专栏。</Text>
            </View>
            <OrderedSteps items={STEPS} />
            <View class="gap-3">
              <Button
                testID="login"
                label="用 GitHub 登录"
                loadingLabel="等待 GitHub 授权…"
                variant="primary"
                loading={pending()}
                onPress={() => void login()}
              />
              <If when={error()}>{(message) => <Notice tone="danger" message={message()} />}</If>
            </View>
          </Card>
        </Appear>
      </View>
    </Scroll>
  );
}
