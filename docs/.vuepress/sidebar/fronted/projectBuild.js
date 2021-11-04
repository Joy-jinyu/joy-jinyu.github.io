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