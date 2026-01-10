const css = require('./css')
const html = require('./html')
const deno = require('./deno')
const javascript = require('./javascript')
const node = require('./node')
const react = require('./react')
const typescript = require('./typescript')
const vue = require('./vue')

module.exports = {
    title: "前端语言",
    collapsable: true,
    children: [
        css,
        html,
        deno,
        javascript,
        node,
        react,
        typescript,
        vue
    ],
}