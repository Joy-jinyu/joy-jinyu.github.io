const projectSummary = require('./projectSummary')
const database = require('./database')
const system = require('./system')
const language = require('./language')

module.exports = [
    {
        title: "前端",
        collapsable: true,
        children: [
            {
                title: "编码基础",
                collapsable: true,
                children: [{
                    title: "开发规范", path: "/fronted/codeBasic/developRule"
                }]
            },
            {
                title: "项目构建",
                collapsable: true,
                children: [{
                    title: "webpack",
                    collapsable: true,
                    children: [{
                        title: "vue-project", path: "/fronted/projectBuild/webpack/vue-project"
                    }]
                }]
            }
        ],
    }, projectSummary, database, system, language
]