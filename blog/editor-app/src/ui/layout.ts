/** 页面左右边距：顶栏、写稿区、底栏都用同一套，和宿主页（博客）顶栏的内容左右对齐。 */
import { windowSize } from "nsh";

/** 窗口窄于等于这个值（pt）算窄屏：边距 16，否则 24。和宿主顶栏的断点、边距一致（宿主 ≤640px 时 16px，否则 24px）。 */
export const COMPACT = 640;

export const compact = () => windowSize().width <= COMPACT;

/** 左右边距的 classList 片段，和别的类合起来用：`classList={{ ...gutter(), "pt-4": true }}`。 */
export const gutter = () => ({ "px-4": compact(), "px-6": !compact() });
