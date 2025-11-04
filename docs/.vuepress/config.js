module.exports = {
    title: '有爱心安 - 花期',
    description: '杂乱无章的技术博客',
    themeConfig: {
        sidebar: [
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
                        children: [ {
                            title: "webpack",
                            collapsable: true,
                            children: [{
                                title: "vue-project", path: "/fronted/codeBasic/webpack/vue-project"
                            }]
                        }]
                    }
                ],
            },
        ]
    }
}