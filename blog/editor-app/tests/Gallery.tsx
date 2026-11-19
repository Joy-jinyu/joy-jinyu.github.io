// ui 层的全部组件、变体、尺寸和状态，放在一页上看（Design Guides「Show it」）。
// 看效果：`nsh run tests/Gallery.tsx --target web`（tests/nsh.json 没有宿主，所以能直接在浏览器里跑）。
import type { JSX } from "nsh";
import { mount, Scroll, signal, Text, View } from "nsh";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Disclosure,
  Empty,
  Field,
  Figure,
  FigureLoading,
  FigureNote,
  IconButton,
  Markdown,
  Notice,
  OrderedSteps,
  RowButton,
  Segmented,
  Separator,
  Sheet,
  Skeleton,
  StatusChip,
  StepList,
  TagInput,
  TextArea,
  TextInput,
  Toolbar,
} from "../src/ui";

function Section(props: { title: string; children?: JSX.Element }) {
  return (
    <View class="gap-3">
      <Text class="font-mono text-xs text-muted-foreground">{props.title}</Text>
      {props.children}
    </View>
  );
}

function Gallery() {
  const title = signal("一篇关于投稿编辑器的文章");
  const tags = signal(["前端", "Rust"]);
  const view = signal<"edit" | "preview">("edit");
  const dialog = signal(false);
  const sheet = signal(false);
  const thinking = signal(true);
  return (
    <Scroll class="flex-1 bg-background">
      <View class="gap-8 p-8">
        <Section title="Button · variant × size">
          <View class="flex-row flex-wrap items-center gap-2">
            <Button label="提交审核…" variant="primary" />
            <Button label="我的投稿" variant="secondary" />
            <Button label="退出" variant="ghost" />
            <Button label="清空…" variant="danger" />
            <Button label="AI 起稿…" icon="sparkle" variant="secondary" size="sm" />
            <Button label="采用" variant="secondary" size="sm" />
          </View>
          <View class="flex-row flex-wrap items-center gap-2">
            <Button label="生成" loadingLabel="生成中…" variant="primary" loading />
            <Button label="退出" variant="ghost" size="sm" loading />
            <Button label="提交审核…" variant="primary" disabled />
            <Button label="润色正文…" icon="sparkle" variant="secondary" size="sm" disabled />
            <IconButton icon="close" label="关闭" />
            <IconButton icon="close" label="关闭" size="sm" />
          </View>
        </Section>
        <Section title="顶栏 · StatusChip + Button size bar（同高 32）">
          <View class="flex-row flex-wrap items-center gap-2">
            <StatusChip label="AI" detail="gpt-4o-mini" tone="ok" hint="AI 模型：gpt-4o-mini" />
            <Button label="我的投稿" size="bar" variant="secondary" />
            <Button label="退出" size="bar" variant="ghost" />
          </View>
          <View class="flex-row flex-wrap items-center gap-2">
            <StatusChip label="AI" detail="vllm/deepseek-r1-distill-qwen-32b-awq" tone="ok" />
            <StatusChip label="AI" tone="ok" accessibilityLabel="AI：gpt-4o-mini，打开 AI 设置" />
            <StatusChip label="AI 未设置" tone="warn" />
            <StatusChip label="AI 状态读取失败" tone="warn" />
            <StatusChip label="AI" tone="warn" loading />
            <Button label="退出" size="bar" variant="ghost" loading />
            <Avatar name="joy" size="sm" label="joy" />
          </View>
        </Section>
        <Section title="Toolbar · 分组（AI / 插入）、不能按时的提示、窄处整组换行">
          <BodyTools />
          <BodyTools empty />
          {/* 390 宽的窗口去掉 16 + 16 边距后正文栏是 358pt：AI 一行、插入一行 */}
          <View class="w-[358px] outline-1 outline-dashed outline-border">
            <BodyTools empty />
          </View>
        </Section>
        <Section title="Dialog · Sheet">
          <View class="flex-row gap-2">
            <Button label="打开对话框…" onPress={() => dialog.set(true)} />
            <Button label="打开侧栏…" onPress={() => sheet.set(true)} />
          </View>
          <Dialog
            open={dialog()}
            onClose={() => dialog.set(false)}
            title="正在提交"
            description="对话框：遮罩淡入，卡片上浮。"
            footer={
              <>
                <Button label="关闭" variant="secondary" onPress={() => dialog.set(false)} />
                <Button label="重试" variant="primary" />
              </>
            }
          >
            <StepList
              steps={[
                { id: "fork", label: "准备仓库", state: "done" },
                { id: "branch", label: "创建分支", state: "active" },
                { id: "commit", label: "写入稿件", state: "pending" },
                { id: "pr", label: "提交 PR", state: "pending" },
              ]}
            />
          </Dialog>
          <Sheet open={sheet()} onClose={() => sheet.set(false)} title="我的投稿">
            <View class="px-2">
              <RowButton title="我的第一篇投稿" role="link" trailing="external" />
            </View>
          </Sheet>
        </Section>
        <Section title="Field · TextInput · TextArea · TagInput · Segmented">
          <View class="max-w-xl gap-5">
            <Field label="标题" count={title().length} max={80}>
              <TextInput label="标题" value={title()} onChange={(v) => title.set(v)} />
            </Field>
            <Field label="一句话摘要" count={152} max={140} error="摘要最多 140 字。">
              <TextArea label="一句话摘要" rows="short" value="超出上限的摘要" invalid onChange={() => {}} />
            </Field>
            <Field label="标签" description="回车或逗号添加，最多 5 个，每个不超过 20 字">
              <TagInput label="标签" tags={tags()} onChange={(t) => tags.set(t)} max={5} maxLength={20} placeholder="比如：前端、Rust" />
            </Field>
            <Field label="空输入" description="占位符和只读">
              <TextInput label="空输入" value="" placeholder="文章标题" onChange={() => {}} />
            </Field>
            <Field label="出错的标题" error="写一个标题。">
              <TextInput label="出错的标题" value="" placeholder="点进来看出错 + 聚焦：只有一圈红色焦点环" invalid onChange={() => {}} />
            </Field>
            <Field label="出错的标签" error="最多 5 个标签。">
              <TagInput label="出错的标签" tags={["前端"]} onChange={() => {}} max={5} maxLength={20} invalid />
            </Field>
            <Segmented
              label="编辑或预览"
              value={view()}
              options={[
                { value: "edit", label: "编辑" },
                { value: "preview", label: "预览" },
              ]}
              onChange={(v) => view.set(v)}
            />
          </View>
        </Section>
        <Section title="Badge · Notice · Avatar">
          <View class="flex-row flex-wrap items-center gap-2">
            <Badge label="审核中" tone="warn" />
            <Badge label="已发布" tone="brand" />
            <Badge label="已关闭" />
            <Badge label="出错" tone="danger" />
            <Avatar name="ada" />
            <Avatar name="joy" size="sm" />
          </View>
          <View class="max-w-xl gap-2">
            <Notice tone="danger" message="fork 还没准备好，过一会儿再提交。" onDismiss={() => {}} />
            <Notice tone="warn" message="AI 还没设置：在站点顶栏的「AI 设置」里填好接口地址、模型和 key。" />
          </View>
        </Section>
        <Section title="Card · StepList · OrderedSteps · RowButton · Empty · Skeleton · Markdown">
          <View class="flex-row flex-wrap gap-4">
            <Card padding="md" class="w-80">
              <StepList
                steps={[
                  { id: "fork", label: "准备仓库", state: "done" },
                  { id: "branch", label: "创建分支", state: "active" },
                  { id: "commit", label: "写入稿件", state: "pending" },
                  { id: "pr", label: "提交 PR", state: "error" },
                ]}
              />
              <Separator />
              <OrderedSteps items={["用 GitHub 登录", "写稿", "提交后会变成一个 PR，审过后发布"]} />
            </Card>
            <Card padding="none" class="w-80 py-2">
              <View class="px-2">
                <RowButton
                  title="我的第一篇投稿"
                  role="link"
                  trailing="external"
                  meta={
                    <View class="flex-row items-center gap-2">
                      <Badge label="审核中" tone="warn" />
                      <Text class="font-mono text-xs text-muted-foreground">#12 · 更新于 2026-11-02</Text>
                    </View>
                  }
                />
              </View>
              <Empty title="还没有投稿" description="提交过的稿件会以 PR 的形式列在这里。" />
              <View class="gap-2 px-5 pb-3">
                <Skeleton shape="line" />
                <Skeleton shape="short" />
              </View>
            </Card>
            <Card padding="md" class="w-96">
              <Markdown text={"## 小节标题\n\n正文里有 `代码`、**强调** 和[链接](https://example.com)。\n\n> 一段引用\n\n```ts\nconst a = 1;\n```"} />
            </Card>
          </View>
        </Section>
        <Section title="Disclosure · Markdown streaming · Figure · FigureLoading · FigureNote">
          <View class="flex-row flex-wrap gap-4">
            <Card padding="md" class="w-96">
              <Disclosure label="思考过程" meta="128 字" open={thinking()} onToggle={() => thinking.set(!thinking())}>
                <Text class="text-xs leading-5 text-muted-foreground">先确定读者是谁，再决定从哪个问题讲起。</Text>
              </Disclosure>
              <Markdown streaming text={"## 正在写的小节\n\n流式输出的最后一段，末尾有**光标"} />
            </Card>
            <Card padding="md" class="w-96">
              <Figure src={SAMPLE_SVG} alt="示例插图" />
              <FigureLoading label="正在载入图片" />
            </Card>
            <Card padding="md" class="w-96">
              <FigureNote message="图片在这台设备上找不到了。重新插入一次就好。" />
              <FigureNote tone="danger" message="Mermaid 图画不出来：第 2 行：箭头后面缺了节点" code={"flowchart LR\n  A -->"} />
            </Card>
          </View>
        </Section>
      </View>
    </Scroll>
  );
}

/** 正文工具栏：empty 时润色和起标题不能按（悬停看「先写正文」）。 */
function BodyTools(props: { empty?: boolean }) {
  const ai = (label: string, needsBody: boolean) => (
    <Button label={label} icon="sparkle" size="sm" variant="secondary" disabled={needsBody && !!props.empty} disabledHint={needsBody ? "先写正文" : undefined} />
  );
  return (
    <Toolbar
      label="正文工具"
      groups={[
        {
          label: "AI",
          items: (
            <>
              {ai("AI 起稿…", false)}
              {ai("润色正文…", true)}
              {ai("起标题和摘要…", true)}
            </>
          ),
        },
        {
          label: "插入",
          items: (
            <>
              <Button label="插入图表…" icon="chart" size="sm" variant="secondary" />
              <Button label="插入图片…" icon="image" size="sm" variant="secondary" />
            </>
          ),
        },
      ]}
    />
  );
}

/** 一张内联的 SVG（data: 地址，和宿主给的 SVG 插图、Mermaid 图同一种），看 Figure 载入后的样子。颜色是图片内容，不是界面 token。 */
const SAMPLE_SVG =
  "data:image/svg+xml;base64," +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" width="320" height="120"><rect x="8" y="8" width="304" height="104" rx="12" fill="none" stroke="#00b8b8" stroke-width="2"/><text x="160" y="68" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#7d8596">SVG 插图</text></svg>').toString("base64");

mount(Gallery);
