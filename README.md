# joy-jinyu.github.io

个人站点，发布到 GitHub Pages：<https://joy-jinyu.github.io/>

| 路径 | 来源 | 说明 |
| --- | --- | --- |
| `/` | `site/index.html` | 简历页，静态 HTML 原样发布（`?theme=light` 切亮色） |
| `/notes/` | `notes/` | 旧技术笔记，VuePress 1.x 构建，`base: '/notes/'` |

## 原理

GitHub Pages 读取 `gh-page` 分支根目录。`deploy-gh.sh` 本地构建 VuePress，把 `site/` 和笔记产物拼进 `public/`，
在 `public/` 里新建仓库后强推到 `gh-page`。`master` 只存源码。

## 命令

```bash
yarn            # 安装依赖
yarn dev        # 本地写笔记
yarn deploy     # 构建并发布
```
