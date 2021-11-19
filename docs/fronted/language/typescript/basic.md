#### TypeScript 业务代码的类型放在哪里?   git: pont

   + 放置在各个业务代码中, 需要复用就导出. (我不建议这样, 比较乱)
   + 任意组织导出, 需要时引用. (不太喜欢对类型的导出导入)
   + 统一放置在业务根目录的 *.d.ts 文件中. (Windows 中不方便使用 * 作为文件名)
   + 统一放置在业务根目录的 custom.d.ts 文件中. (曾经做法) 采用
   + 统一放置在业务下的 @[types](https://www.v2ex.com/member/types) 目录中, 目录下可以有多个 .d.ts 结尾的文件. (目前做法)
   + 写一个私有的类型模块, 存放所有类型, 然后在业务代码中引用. (做法有点歪)

#### 依赖typescript并且声称tsconfig.json 

   **solve**

   + (1).npm i --save-dev typescript 

   ​+ (2).tsc --init

#### 项目中切忌使用any ！important

