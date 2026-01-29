const codeBasic = require('./codeBasic')
const compatible = require('./compatible')
const faceToFace = require('./faceToFace')
const instantMessage = require('./instantMessage')
const keyword = require('./keyword')
const language = require('./language')
const mobile = require('./mobile')
const optimization = require('./optimization')
const projectBuild = require('./projectBuild')
const soft = require('./soft')
const test = require('./test')

module.exports = {
    title: "前端",
    collapsable: true,
    children: [
        codeBasic,
        compatible,
        faceToFace,
        instantMessage,
        keyword,
        language,
        mobile,
        optimization,
        projectBuild,
        soft,
        test
    ],
}