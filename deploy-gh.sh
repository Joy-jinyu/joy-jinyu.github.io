git add .
git commit -m '除前端外的文档全部提交'
# 提交代码
git push -u origin master

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
git commit -m '更新文档'

# 把上面的 <USERNAME> 换成你自己的 Github 用户名，<REPO> 换成仓库名，比如我这里就是：
git push -f https://github.com/Joy-jinyu/joy.github.io.git master:gh-page

cd -