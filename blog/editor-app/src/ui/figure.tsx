/** 正文里的图：载入前同尺寸占位，载入后淡入并换成图片自己的比例；找不到或出错时的说明块。 */
import { Image, reduceMotion, signal, Text, View } from "nsh";
import { duration } from "./motion";
import { Spinner } from "./spinner";

/** 还不知道图片比例时，占位框的宽高比。 */
const PLACEHOLDER_RATIO = 16 / 9;

/**
 * 一张图：宽度跟正文走，不超过图片自己的宽度。`src` 要在创建时就定下（换图就重建它）；
 * `data:` 和 `blob:` 总能载入，别的站点的图要应用的 `network` 权限放行。
 */
export function Figure(props: { src: string; alt: string; testID?: string }) {
  const loaded = signal(false);
  /** 图片自己的尺寸；平台报不出来（0）时保持占位比例。 */
  const natural = signal<{ width: number; height: number } | null>(null);
  const failed = signal(false);
  return (
    <If when={!failed()} else={<FigureNote testID={props.testID} tone="danger" message="图片没能载入。" />}>
      <View
        testID={props.testID}
        class="w-full overflow-hidden rounded-(--radius)"
        classList={{ "bg-muted": !loaded() }}
        style={{ aspectRatio: natural() ? natural()!.width / natural()!.height : PLACEHOLDER_RATIO, maxWidth: natural()?.width }}
      >
        <Image
          src={props.src}
          accessibilityLabel={props.alt}
          fadeDuration={reduceMotion() ? 0 : duration.base}
          class="size-full object-contain"
          onLoad={(e) => {
            if (e.size.width > 0 && e.size.height > 0) natural.set({ width: e.size.width, height: e.size.height });
            loaded.set(true);
          }}
          onError={() => failed.set(true)}
        />
        <If when={!loaded()}>
          <View accessibilityElementsHidden class="absolute inset-0 items-center justify-center">
            <Spinner tone="muted" label="正在载入图片" />
          </View>
        </If>
      </View>
    </If>
  );
}

/** 地址还没拿到时的占位：和 `Figure` 载入前同一个样子。 */
export function FigureLoading(props: { label: string; testID?: string }) {
  return (
    <View testID={props.testID} class="w-full items-center justify-center rounded-(--radius) bg-muted" style={{ aspectRatio: PLACEHOLDER_RATIO }}>
      <Spinner tone="muted" label={props.label} />
    </View>
  );
}

/** 图片的位置上显示一句说明：muted 是缺了（找不到），danger 是出错；`code` 给了就在下面等宽显示（画错的 Mermaid 代码）。 */
export function FigureNote(props: { message: string; tone?: "muted" | "danger"; code?: string; testID?: string }) {
  const danger = () => props.tone === "danger";
  return (
    <View
      testID={props.testID}
      role="alert"
      class="w-full gap-2 rounded-(--radius) border px-4 py-3"
      classList={{ "border-border bg-muted": !danger(), "border-transparent bg-destructive-tint": danger() }}
    >
      <Text class="text-sm" classList={{ "text-muted-foreground": !danger(), "text-destructive": danger() }}>
        {props.message}
      </Text>
      <If when={props.code}>
        <View selectable class="rounded-(--radius-sm) bg-background px-3 py-2">
          <Text class="font-mono text-xs leading-5 text-strong">{props.code}</Text>
        </View>
      </If>
    </View>
  );
}
