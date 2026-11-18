/** 应用级提示（退出失败、打不开 AI 设置之类）：写稿页顶栏下面显示一条，可关闭。 */
import { signal } from "nsh";

const message = signal<string | null>(null);

export const currentNotice = () => message();
export const showNotice = (text: string) => message.set(text);
export const dismissNotice = () => message.set(null);
