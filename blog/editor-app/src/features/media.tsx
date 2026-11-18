/** 正文里的图片和 Mermaid 图怎么显示：投稿图片的地址找宿主换成预览地址，Mermaid 交给宿主渲染。只影响显示，不改正文。 */
import { colorScheme, resource } from "nsh";
import { MEDIA_PATH } from "../../../src/lib/editor-host/contract";
import { Figure, FigureLoading, FigureNote, Markdown } from "../ui";
import { call, messageOf } from "./host";

/** 按正文里的地址缓存预览地址；失败的不留，下次再问。 */
const mediaUrls = new Map<string, Promise<string | null>>();
/** 按明暗 + 代码缓存渲染结果。 */
const diagrams = new Map<string, Promise<string>>();

function mediaUrl(path: string): Promise<string | null> {
  let url = mediaUrls.get(path);
  if (!url) {
    url = call("media.url", { path }).then((r) => r?.url ?? null);
    url.catch(() => mediaUrls.delete(path));
    mediaUrls.set(path, url);
  }
  return url;
}

/** 把 Mermaid 代码渲染成图片地址（缓存）；代码有错时 reject 宿主给的错误。 */
export function renderDiagram(code: string, dark: boolean): Promise<string> {
  const key = `${dark ? "dark" : "light"}\n${code}`;
  let url = diagrams.get(key);
  if (!url) {
    url = call("diagram.render", { code, dark }).then((r) => r.url);
    url.catch(() => diagrams.delete(key));
    diagrams.set(key, url);
  }
  return url;
}

/** 正文的 Markdown：投稿图片和 Mermaid 图都画出来。预览、AI 结果都用它。 */
export function BodyMarkdown(props: { text: string; testID?: string }) {
  return (
    <Markdown
      testID={props.testID}
      text={props.text}
      renderImage={(image) => <BodyImage src={image.src} alt={image.alt ?? ""} />}
      renderDiagram={(code) => <Diagram code={code} />}
    />
  );
}

/** 正文里的一张图：投稿图片先换成预览地址，别的地址直接显示。 */
export function BodyImage(props: { src: string; alt: string }) {
  if (!MEDIA_PATH.test(props.src)) return <Figure src={props.src} alt={props.alt} />;
  const url = resource(() => mediaUrl(props.src));
  return (
    <>
      {url.error() ? (
        <FigureNote tone="danger" message={`图片没能载入：${messageOf(url.error())}`} />
      ) : url() === undefined ? (
        <FigureLoading label="正在载入图片" />
      ) : url() === null ? (
        <FigureNote testID="media-missing" message="图片在这台设备上找不到了。重新插入一次就好。" />
      ) : (
        <Figure testID="media-image" src={url()!} alt={props.alt} />
      )}
    </>
  );
}

/** 一张 Mermaid 图：跟着当前明暗渲染；代码有错就显示错误和代码。 */
export function Diagram(props: { code: string; testID?: string }) {
  // 来源用 "light" / "dark" 而不是布尔值：resource 的来源是 false 时不加载。
  const url = resource(colorScheme, (scheme) => renderDiagram(props.code, scheme === "dark"));
  return (
    <>
      {url.error() ? (
        <FigureNote testID={props.testID ?? "diagram-error"} tone="danger" message={`Mermaid 图画不出来：${messageOf(url.error())}`} code={props.code} />
      ) : url() === undefined ? (
        <FigureLoading testID={props.testID} label="正在画图" />
      ) : (
        <Figure testID={props.testID ?? "diagram"} src={url()!} alt="Mermaid 图" />
      )}
    </>
  );
}
