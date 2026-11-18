/** 启动时的两屏：正在读取登录状态、读取失败。 */
import { Text, View } from "nsh";
import { Appear, Button, Notice, Spinner } from "../ui";
import { loadLogin, sessionError } from "./session";

export function BootLoading() {
  return (
    <View class="flex-1 items-center justify-center gap-3 p-6">
      <Spinner label="正在读取登录状态" />
      <Text class="text-sm text-muted-foreground">正在读取登录状态</Text>
    </View>
  );
}

export function BootError() {
  return (
    <View class="flex-1 items-center justify-center p-6">
      <Appear kind="page" class="w-full max-w-md gap-3">
        <Notice tone="danger" message={`没能读取登录状态：${sessionError() ?? ""}`} />
        <Button label="重试" variant="secondary" class="self-start" onPress={() => void loadLogin()} />
      </Appear>
    </View>
  );
}
