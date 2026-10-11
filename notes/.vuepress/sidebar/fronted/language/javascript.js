module.exports = {
    title: "Javascript",
    collapsable: true,
    children: [
        {
            title: '基础', path: '/fronted/language/javascript/basic.md'
        },
        {
            title: 'Ast', path: '/fronted/language/javascript/ast.md'
        },
        {
            title: 'es6', path: '/fronted/language/javascript/es6.md'
        },
        {
            title: 'eventLoop', path: '/fronted/language/javascript/eventLoop.md'
        },
        {
            title: '执行机制', path: '/fronted/language/javascript/operatingMechanism.md'
        },
        {
            title: '你不知道的Javascript - 阅读笔记',
            collapsable: true,
            children: [
                {
                    title: '作用域和闭包', path: '/fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01.md'
                },
                {
                    title: 'this和原型链', path: '/fronted/language/javascript/theJavaScriptYouDontKonw/thisAndPrototype_02.md'
                },
            ]
        },
    ],
}