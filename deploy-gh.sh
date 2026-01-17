# 确保脚本抛出遇到的错误
set -e

# 生成静态文件
npm run build

# 进入生成的文件夹
cd docs/.vuepress/dist

# 如果是发布到自定义域名
echo 'joy.github.io' > CNAME

git init
git add -A
git commit -m '页面构建提交'

# 将 目录 **docs/.vuepress/dist** 下的 master 分支提交到 git@github.com:Joy-jinyu/joy-jinyu.github.io.git 的 gh-page 分支
git push -f git@github.com:Joy-jinyu/joy-jinyu.github.io.git master:gh-page

cd -
# 提交代码仓库
git add .
git commit -m '文档更新'
# 提交代码
git push -u origin master
