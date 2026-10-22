# joy-jinyu.github.io

个人站点，发布到 GitHub Pages：<https://joy-jinyu.github.io/>

| 路径 | 来源 | 说明 |
| --- | --- | --- |
| `/` | `site/index.html` | 简历页，静态 HTML 原样发布（`?theme=light` 切亮色） |
| `/notes/` | `notes/` | 技术笔记，Astro Starlight 构建，`base: '/notes'`，文章在 `notes/src/content/docs/`，侧边栏在 `notes/sidebar.mjs` |
| `/blog/` | `blog/` | 博客，Astro + MDX 构建，`base: '/blog'`，文章在 `blog/src/content/posts/`（文件名即 URL），可在 MDX 里用 `blog/src/components/` 的组件 |

## 原理

GitHub Pages 读取 `gh-page` 分支根目录。`deploy-gh.sh` 本地构建笔记和博客，把 `site/`、笔记、博客产物拼进 `public/`，
在 `public/` 里新建仓库后强推到 `gh-page`。`master` 只存源码。

## 命令

```bash
yarn            # 安装依赖
yarn dev        # 本地写笔记
yarn dev:blog   # 本地写博客（地址见终端输出，路径带 /blog/）
yarn deploy     # 构建并发布
```
