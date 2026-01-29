const sidebar = require('./sidebar')

module.exports = {
    title: '有爱心安 - 花期',
    description: '杂乱无章的技术博客',
    // 笔记站挂在 /notes/ 子路径下，根路径留给简历页（site/index.html）
    base: '/notes/',
    themeConfig: {
        nav: [
            { text: '简历', link: 'https://joy-jinyu.github.io/' }
        ],
        sidebar: sidebar
    }
}
