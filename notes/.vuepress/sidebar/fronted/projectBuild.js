module.exports = {
    title: "项目构建",
    collapsable: true,
    children: [
        {
            title: "简介", path: "/fronted/projectBuild/introduction"
        },
        {
            title: "webpack",
            collapsable: true,
            children: [
                {
                    title: "背景", path: "/fronted/projectBuild/webpack/background"
                },
                {
                    title: "概念", path: "/fronted/projectBuild/webpack/concept"
                },
                {
                    title: "配置", path: "/fronted/projectBuild/webpack/configuration"
                },
                {
                    title: "API", path: "/fronted/projectBuild/webpack/api"
                },
                {
                    title: "错误", path: "/fronted/projectBuild/webpack/error"
                },
                {
                    title: "vue项目", path: "/fronted/projectBuild/webpack/vueProject"
                }
            ]
        },
        {
            title: "postcss",
            collapsable: true,
            children: [
                {
                    title: "简介", path: "/fronted/projectBuild/postcss/introduction"
                },
                {
                    title: "编译器", path: "/fronted/projectBuild/postcss/translate"
                },
            ]
        },
        {
            title: "rollup",
            collapsable: true,
            children: [
            ]
        },
    ]
}