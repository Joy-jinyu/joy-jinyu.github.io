const fronted = require('./fronted')
const projectSummary = require('./projectSummary')
const database = require('./database')
const system = require('./system')
const language = require('./language')

module.exports = [
    fronted, projectSummary, database, system, language
]