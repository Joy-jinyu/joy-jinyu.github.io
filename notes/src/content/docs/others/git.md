---
title: Git 常用操作
description: 从工作区、暂存区、仓库的概念讲起，整理日常提交、分支、合并与变基、撤销与回退、stash、标签、远程协作、查看历史等常用命令及常见问题处理。
---

Git 的命令很多，但日常开发用到的只是其中一小部分。这篇先讲清楚几个核心概念，再按场景整理常用命令：日常提交、分支、合并与变基、撤销回退、暂存、标签、远程协作和查看历史，最后列出几个常见问题的处理方法。命令以较新的 Git 版本为准，`git switch`、`git restore` 等命令需要 Git 2.23 及以上版本。

## 基本概念

### 四个区域

| 区域 | 说明 |
| --- | --- |
| 工作区（working tree） | 磁盘上能看到、能编辑的文件。 |
| 暂存区（index / staging area） | 下一次提交的内容快照。`git add` 把工作区的修改放进暂存区。 |
| 本地仓库（repository） | `.git` 目录，保存所有提交历史。`git commit` 把暂存区的内容生成一个新提交。 |
| 远程仓库（remote） | 托管在服务器上的仓库，通过 `push` / `fetch` 与本地同步。默认名叫 `origin`。 |

一次修改的典型流向：工作区 →（`git add`）→ 暂存区 →（`git commit`）→ 本地仓库 →（`git push`）→ 远程仓库。

### 提交、分支与 HEAD

- **提交（commit）**：一次完整的项目快照，由一个哈希值标识，并记录它的父提交，所有提交连成一张历史图。
- **分支（branch）**：指向某个提交的可移动指针。在分支上提交时，分支指针会自动前移到新提交。
- **HEAD**：指向"当前所在位置"，通常指向当前分支。如果直接检出某个提交而不是分支，HEAD 会直接指向该提交，称为"分离头指针"（detached HEAD）状态。
- **远程跟踪分支**：如 `origin/main`，记录上次与远程同步时远程分支的位置。它只在 `fetch` / `pull` / `push` 时更新，不会自己变化。

### 初次配置

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main   # 新建仓库的默认分支名
git config --global pull.rebase true          # 可选：pull 时默认变基而不是合并
```

## 日常流程

```bash
git clone <仓库地址>        # 克隆远程仓库
git status                  # 查看当前状态：哪些文件改了、哪些已暂存
git diff                    # 查看工作区相对暂存区的改动
git diff --staged           # 查看暂存区相对最新提交的改动
git add <文件>              # 暂存指定文件
git add -p                  # 逐块选择要暂存的改动
git commit -m "feat: 新增登录页"
git push                    # 推送到当前分支的上游
```

几点建议：

- 用 `git add <路径>` 只暂存相关文件，提交前用 `git diff --staged` 再看一遍。`git add .` 容易把无关文件一起提交。
- 不需要纳入版本管理的文件（`node_modules/`、构建产物、本地环境变量文件）写进 `.gitignore`。
- 提交信息的写法见 [前端开发规范](/notes/fronted/codeBasic/developRule.html) 中的 Git 提交规范。

## 分支操作

```bash
git branch                       # 列出本地分支
git branch -a                    # 列出本地和远程跟踪分支
git switch <分支>                # 切换分支
git switch -c <新分支>           # 基于当前位置创建并切换
git switch -c <新分支> <起点>    # 基于指定分支或提交创建
git branch -m <旧名> <新名>      # 重命名分支
git branch -d <分支>             # 删除已合并的分支
git branch -D <分支>             # 强制删除（未合并也删）
```

`git checkout` 同时承担了切换分支和恢复文件两种职责，容易误用。Git 2.23 起拆分成 `git switch`（切换分支）和 `git restore`（恢复文件），建议优先使用新命令。旧写法 `git checkout -b <新分支>` 仍然可用。

### 拉取远程分支到本地

同事推送了一个新分支 `feature/login`，要在本地切换过去：

```bash
git fetch origin
git switch feature/login
```

本地没有同名分支、而某个远程上恰好有同名分支时，`git switch` 会自动创建本地分支并设置好上游。等价的完整写法：

```bash
git switch -c feature/login --track origin/feature/login
```

### 把本地新分支推送到远程

```bash
git switch -c feature/search
# ...提交若干次
git push -u origin feature/search
```

`-u`（`--set-upstream`）把 `origin/feature/search` 设为当前分支的上游，之后直接 `git push`、`git pull` 即可。

## 合并与变基

把分支 `feature` 的修改整合进 `main`，有两种方式。

### merge

```bash
git switch main
git merge feature
```

- 如果 `main` 在分叉后没有新提交，Git 直接把 `main` 指针移到 `feature` 的位置，称为快进（fast-forward），不产生新提交。
- 如果两边都有新提交，Git 生成一个有两个父提交的合并提交，保留分支的完整历史。
- 使用 `git merge --no-ff feature` 可以强制生成合并提交，在历史中保留"这里合并过一个分支"的痕迹。

### rebase

```bash
git switch feature
git rebase main
```

rebase 把 `feature` 上独有的提交逐个"重新应用"到 `main` 的最新提交之后，得到一条线性的历史。被重新应用的提交内容相同，但哈希值都变了，它们是新的提交。

### 区别与选择

| 对比项 | merge | rebase |
| --- | --- | --- |
| 历史形态 | 保留分叉，可能产生合并提交 | 线性，没有合并提交 |
| 是否改写已有提交 | 不改写 | 改写（生成新提交） |
| 冲突处理 | 一次性解决所有冲突 | 每个被重放的提交都可能需要单独解决冲突 |
| 适用场景 | 把功能分支合入共享的主干分支 | 在自己的功能分支上同步主干的最新代码，整理提交 |

:::danger
不要对已经推送、并且别人可能基于它工作的分支执行 rebase。改写后的历史与别人本地的历史对不上，会造成重复提交和混乱。rebase 只用于还没共享、或只有自己使用的分支。
:::

### 交互式变基：整理提交

推送前想合并几个零碎的提交、修改提交信息，可以用交互式变基：

```bash
git rebase -i HEAD~3   # 整理最近 3 个提交
```

编辑器中每个提交前的指令可以改为 `pick`（保留）、`reword`（改提交信息）、`squash`（合并到上一个提交并编辑信息）、`fixup`（合并到上一个提交并丢弃本提交信息）、`drop`（删除）等。

### 解决冲突

合并或变基遇到冲突时，Git 会停下来，冲突文件中出现标记：

```text
<<<<<<< HEAD
当前分支的内容
=======
被合入分支的内容
>>>>>>> feature
```

上面是 merge 时的含义。rebase 时两侧会对调：`HEAD` 一侧是正在被重放到其上的上游提交（比如 main），另一侧才是你自己的提交。

处理步骤：

1. 编辑文件，保留正确的内容，删除冲突标记。
2. `git add <文件>` 标记为已解决。
3. 继续：merge 时执行 `git commit`（或 `git merge --continue`）；rebase 时执行 `git rebase --continue`。
4. 想放弃本次操作：`git merge --abort` 或 `git rebase --abort`，回到操作前的状态。

### cherry-pick：只拿某几个提交

```bash
git cherry-pick <提交哈希>
```

把指定提交的改动复制到当前分支，生成一个新提交。常用于把某个修复同步到发布分支。

## 撤销与回退

撤销操作最容易混淆。先分清要撤销的是哪个区域的修改，再选命令。

### 三个命令的区别

| 命令 | 作用对象 | 是否改写历史 | 典型用途 |
| --- | --- | --- | --- |
| `git restore` | 工作区、暂存区的文件 | 否 | 丢弃未提交的修改，或取消暂存 |
| `git reset` | 当前分支指针（及暂存区、工作区） | 是 | 撤销本地还没推送的提交 |
| `git revert` | 生成一个反向提交 | 否 | 撤销已经推送的提交 |

### restore：处理未提交的修改

```bash
git restore <文件>                  # 丢弃工作区的修改，恢复到暂存区的版本
git restore --staged <文件>         # 取消暂存，修改仍保留在工作区
git restore --source=HEAD~1 <文件>  # 把文件恢复成上一个提交里的版本
```

`git restore <文件>` 丢弃的修改无法通过 Git 找回，执行前确认。

### reset：移动分支指针

```bash
git reset --soft HEAD~1    # 撤销最近一次提交，改动保留在暂存区
git reset --mixed HEAD~1   # 默认模式：撤销提交，改动保留在工作区，不暂存
git reset --hard HEAD~1    # 撤销提交，并丢弃这些改动
```

三种模式的区别：

| 模式 | 分支指针 | 暂存区 | 工作区 |
| --- | --- | --- | --- |
| `--soft` | 移动 | 不变 | 不变 |
| `--mixed` | 移动 | 重置为目标提交 | 不变 |
| `--hard` | 移动 | 重置为目标提交 | 重置为目标提交 |

`--hard` 会丢弃工作区里未提交的修改，这部分无法找回；已提交过的内容则可以通过 `reflog` 找回（见后文）。

### revert：撤销已推送的提交

```bash
git revert <提交哈希>
```

生成一个新提交，内容正好抵消指定提交的改动。历史不被改写，适合已经推送到共享分支的提交。撤销合并提交时需要用 `-m 1` 指定以哪个父提交为主线：

```bash
git revert -m 1 <合并提交哈希>
```

### 修改最近一次提交

```bash
git commit --amend                 # 修改提交信息，或把暂存区新内容加入上次提交
git commit --amend --no-edit       # 只追加内容，不改提交信息
```

`--amend` 会生成新提交替换原提交，同样不要用在已经推送并共享的提交上。

## 暂存：stash

开发到一半需要切到别的分支处理紧急问题，又不想提交半成品时，用 stash 临时保存修改：

```bash
git stash push -m "登录页开发中"   # 保存已跟踪文件的修改
git stash push -u                  # 连同未跟踪的新文件一起保存
git stash list                     # 查看所有暂存记录
git stash pop                      # 恢复最近一条并从列表删除
git stash apply stash@{1}          # 恢复指定一条，但保留在列表中
git stash drop stash@{1}           # 删除指定一条
git stash show -p stash@{0}        # 查看某条记录的具体改动
```

默认的 `git stash` 不会保存未跟踪的新文件，需要时加 `-u`。stash 适合短期使用，长期保留的工作还是提交到一个临时分支更可靠。

## 标签

标签用来标记发布版本等重要提交。

```bash
git tag                                  # 列出标签
git tag -a v1.2.0 -m "发布 1.2.0"        # 创建附注标签（推荐，包含作者、日期、说明）
git tag v1.2.0-temp                      # 创建轻量标签（只是一个名字）
git tag -a v1.1.1 <提交哈希> -m "补打标签" # 给历史提交打标签
git show v1.2.0                          # 查看标签信息
git push origin v1.2.0                   # 推送单个标签
git push origin --tags                   # 推送所有本地标签
git tag -d v1.2.0                        # 删除本地标签
git push origin --delete v1.2.0          # 删除远程标签
```

`git push` 默认不会推送标签，需要单独推送。

## 远程协作

### 管理远程仓库

```bash
git remote -v                          # 查看远程仓库地址
git remote add origin <仓库地址>        # 添加远程仓库
git remote set-url origin <新地址>      # 修改远程地址
```

### fetch、pull、push

| 命令 | 作用 |
| --- | --- |
| `git fetch` | 从远程下载最新的提交，更新远程跟踪分支（如 `origin/main`），不改动本地分支和工作区 |
| `git pull` | 相当于 `git fetch` 后再把上游分支合并（或变基）到当前分支 |
| `git push` | 把本地分支的提交上传到远程 |

```bash
git fetch --prune            # 同时清理远程已删除分支对应的跟踪分支
git pull --rebase            # 拉取并用变基整合，避免产生多余的合并提交
git push origin --delete feature/old   # 删除远程分支
```

想先看看远程有什么变化再决定如何整合，用 `git fetch` 加 `git log HEAD..origin/main` 查看，比直接 `pull` 更可控。

### 上游分支

上游（upstream）是本地分支默认对应的远程分支，设置后 `git pull`、`git push`、`git status` 都会以它为参照：

```bash
git branch -vv                          # 查看各分支的上游及领先/落后的提交数
git branch -u origin/feature/login      # 为当前分支设置上游
git push -u origin feature/login        # 推送的同时设置上游
```

### 强制推送

自己的功能分支在 rebase 或 amend 之后，需要强制推送覆盖远程。使用更安全的 `--force-with-lease`：

```bash
git push --force-with-lease
```

它只在远程分支仍处于你上次获取时的状态才会覆盖；如果期间别人推送了新提交，推送会被拒绝，避免误删别人的工作。尽量不要用 `--force`，更不要对 `main` 等共享分支强制推送。

## 查看历史

```bash
git log --oneline --graph --all     # 单行显示，带分支图
git log -p <文件>                   # 查看某个文件每次提交的具体改动
git log --author="Tom" --since="2 weeks ago"
git log -S "fetchUser"              # 查找增加或删除了某段文本的提交
git show <提交哈希>                 # 查看某次提交的内容
git blame <文件>                    # 查看每一行最后由哪次提交修改
git diff main...feature             # 查看 feature 分叉后相对 main 的改动
```

`git diff A...B`（三个点）比较的是 B 与 A、B 的共同祖先之间的差异，也就是"B 分支自己做了什么"，常用于审查合并请求；`git diff A..B`（两个点）与 `git diff A B` 相同，直接比较两个提交。

### reflog：找回"丢失"的提交

reflog 记录了本地 HEAD 和分支指针的每一次移动，包括 reset、rebase、amend 之前的位置：

```bash
git reflog
# a1b2c3d HEAD@{0}: reset: moving to HEAD~1
# e4f5a6b HEAD@{1}: commit: feat: 新增登录页
git reset --hard e4f5a6b   # 回到 reset 之前的状态
```

只要是提交过的内容，误操作后通常都能通过 reflog 找回。reflog 只存在于本地，并且旧记录会在一段时间后被清理。

## 常见问题处理

### 提交到了错误的分支

在 `main` 上做了一个本该在功能分支上的提交，且还没推送：

```bash
git switch -c feature/fix   # 在当前位置新建分支，保留这个提交
git switch main
git reset --hard HEAD~1     # main 回退一个提交
```

### 提交信息写错了

还没推送：`git commit --amend` 修改。已经推送到共享分支：一般不再修改，避免改写共享历史。

### 不小心提交了不该提交的文件

```bash
git rm --cached .env        # 从版本库移除，但保留本地文件
echo ".env" >> .gitignore
git commit -m "chore: 移除误提交的环境变量文件"
```

如果误提交的是密钥、密码，仅仅删除文件不够，它仍然存在于历史中。应当立即在对应平台作废并更换密钥，再考虑用 `git filter-repo` 等工具清理历史。

### .gitignore 不生效

`.gitignore` 只对未被跟踪的文件生效。文件已经提交过，需要先从索引中移除：

```bash
git rm -r --cached <路径>
git commit -m "chore: 停止跟踪构建产物"
```

### 推送被拒绝（non-fast-forward）

远程分支有本地没有的新提交时，`git push` 会被拒绝。先整合远程的修改再推送：

```bash
git pull --rebase
git push
```

### 处于分离头指针状态

`git status` 提示 `HEAD detached at ...`，说明当前没有在任何分支上。如果在这个状态下做了提交，想保留它们：

```bash
git switch -c temp-branch   # 基于当前位置创建分支
```

否则直接 `git switch <分支>` 切回即可。

## 小结

- 修改依次经过工作区、暂存区、本地仓库、远程仓库；分支是指向提交的指针，HEAD 表示当前位置。
- 切换分支用 `git switch`，恢复文件用 `git restore`。
- merge 保留分叉历史、不改写提交；rebase 得到线性历史但改写提交，只用于未共享的分支。
- 未提交的修改用 `restore`，未推送的提交用 `reset`，已推送的提交用 `revert`。
- 强制推送用 `--force-with-lease`；误操作后先看 `git reflog`。

## 参考

- [Git 官方文档](https://git-scm.com/docs)
- [Pro Git（中文版）](https://git-scm.com/book/zh/v2)
- [git-switch](https://git-scm.com/docs/git-switch)
- [git-restore](https://git-scm.com/docs/git-restore)
- [git-reset](https://git-scm.com/docs/git-reset)
- [git-rebase](https://git-scm.com/docs/git-rebase)
- [git-stash](https://git-scm.com/docs/git-stash)
- [git-reflog](https://git-scm.com/docs/git-reflog)
