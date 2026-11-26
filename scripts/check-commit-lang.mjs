#!/usr/bin/env node
/**
 * 提交信息只能用英文：出现中日韩文字或全角标点就拒绝。
 * 用法：--file <提交信息文件>（commit-msg 钩子）；--range <a..b> 或 --all <rev>（CI，逐个检查提交）
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}　-〿︐-︟︰-﹏＀-￯]/u

/**
 * 钩子拿到的是 git 清理前的原文。# 开头的行不跳过：用 -m 提交时 git 会原样保存它们，跳过就和 CI 的结果对不上。
 * 只去掉 --verbose 剪刀线以下的 diff（那部分 git 一定会丢掉，里面可能有中文正文）
 */
function stripVerboseDiff(text) {
  const scissors = text.indexOf('------------------------ >8 ------------------------')
  return scissors === -1 ? text : text.slice(0, text.lastIndexOf('\n', scissors) + 1)
}

function offendingLines(message) {
  return message.split('\n').filter((line) => CJK.test(line))
}

function report(label, lines) {
  console.error(`✖ ${label}: commit messages must be written in English. Offending lines:`)
  for (const line of lines) console.error(`    ${line}`)
}

function checkLog(revArgs, label) {
  let log
  try {
    log = execFileSync('git', ['log', '--format=%H%x1f%B%x1e', ...revArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    console.error(`✖ git log ${revArgs.join(' ')} failed: ${String(err.stderr || err.message).trim()}`)
    process.exit(2)
  }
  const commits = log
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, message] = entry.split('\x1f')
      return { sha, lines: offendingLines(message) }
    })
  const bad = commits.filter((c) => c.lines.length)
  for (const c of bad) report(c.sha.slice(0, 7), c.lines)
  if (bad.length) process.exit(1)
  console.log(`✔ ${commits.length} commit(s) in ${label} have English messages`)
}

const [mode, arg] = process.argv.slice(2)

if (mode === '--file' && arg) {
  const lines = offendingLines(stripVerboseDiff(readFileSync(arg, 'utf8')))
  if (lines.length) {
    report('commit rejected', lines)
    process.exit(1)
  }
} else if (mode === '--range' && arg) {
  checkLog([arg], arg)
} else if (mode === '--all' && arg) {
  checkLog([arg], `the history of ${arg}`)
} else {
  console.error('usage: check-commit-lang.mjs --file <msg-file> | --range <a..b> | --all <rev>')
  process.exit(2)
}
