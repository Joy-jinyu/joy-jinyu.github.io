module.exports = {
    title: "系统",
    collapsable: true,
    children: [
        {
            title: 'linux',
            collapsable: true,
            children: [
                {
                    title: "基础",
                    path: '/system/linux/basic'
                },
                {
                    title: "软件",
                    path: '/system/linux/soft'
                },
                {
                    title: "vim",
                    path: '/system/linux/vim'
                }
            ]
        },
        {
            title: '浏览器',
            collapsable: true,
            children: [
                {
                    title: "基础",
                    path: '/system/browser/basic'
                },
                {
                    title: "cookie",
                    path: '/system/browser/cookies'
                }
            ]
        },
    ]
}