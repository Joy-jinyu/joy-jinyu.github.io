// 投稿编辑器的外壳：启动会话、读回草稿，按登录状态切换屏幕。
import { mount, View } from "nsh";
import { BootError, BootLoading } from "./src/features/Boot";
import { restoreDraft } from "./src/features/draft";
import { phase, startSession } from "./src/features/session";
import { SignedOut } from "./src/features/SignedOut";
import { Writing } from "./src/features/Writing";

function App() {
  startSession();
  void restoreDraft();
  return <View class="flex-1 bg-background">{screen(phase())}</View>;
}

function screen(current: ReturnType<typeof phase>) {
  switch (current) {
    case "loading":
      return <BootLoading />;
    case "error":
      return <BootError />;
    case "out":
      return <SignedOut />;
    case "in":
      return <Writing />;
  }
}

mount(App);
