module.exports = {
    title: "移动端",
    collapsable: true,
    children: [
        {
            title: "简介", path: "/fronted/mobile/introduction",
        },
        {
            title: "flutter",
            collapsable: true,
            children: [
                {
                    title: "环境搭建", path: "/fronted/mobile/flutter/environment"
                },
                {
                    title: "实战", path: "/fronted/mobile/flutter/practise"
                },
                {
                    title: "dart",
                    collapsable: true,
                    children: [
                        { 
                            title: "基础知识", path: "/fronted/mobile/flutter/dart/basic"
                        },
                        { 
                            title: "编码规则", path: "/fronted/mobile/flutter/dart/codeRule"
                        },
                        { 
                            title: "语法", path: "/fronted/mobile/flutter/dart/grammar"
                        }
                    ]
                }
            ]
        }
    ]
}