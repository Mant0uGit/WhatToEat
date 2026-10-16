/**
 * 结构自检：
 *  1. 所有 JS 文件括号/引号配平（防止模板字符串里写坏 CSS 导致整个文件报错）；
 *  2. CSS 花括号配平；
 *  3. HTML 里引用的本地资源都真实存在；
 *  4. 模板里 Vue 指令的引号配平。
 *
 * 运行：node tests/structure.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
function check(name, fn) {
  try {
    fn()
    pass += 1
    console.log('  ✅ ' + name)
  } catch (err) {
    fail += 1
    console.log('  ❌ ' + name)
    console.log('     ' + (err && err.message ? err.message : err))
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'vendor' || entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(root)
const jsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))

console.log('\n── 结构自检 ──')

check('找到源码文件（js/mjs: ' + jsFiles.length + ' 个）', () => {
  if (jsFiles.length < 10) throw new Error('文件数量偏少，可能路径写错了')
})

for (const file of jsFiles) {
  const rel = path.relative(root, file)
  const src = fs.readFileSync(file, 'utf8')

  check('括号配平: ' + rel, () => {
    const stack = []
    const pairs = { ')': '(', ']': '[', '}': '{' }
    // 上一个「有意义的」字符，用来判断 / 是除号还是正则开始
    let lastSig = ''
    let state = 'code'
    let inClass = false // 正则里的 [...] 字符组，组内的 / 不是正则结束符
    for (let i = 0; i < src.length; i += 1) {
      const c = src[i]
      const next = src[i + 1]

      if (state === 'code') {
        if (c === '/' && next === '/') {
          state = 'line'
          i += 1
          continue
        }
        if (c === '/' && next === '*') {
          state = 'block'
          i += 1
          continue
        }
        if ('\'"`'.includes(c)) {
          state = c
          continue
        }
        // 正则字面量：前一个有效字符不能是「表达式结尾」（标识符、右括号、数字等）
        // 也不能是 /，因为 /^\/+/ 这种写法里 / 会紧跟在 / 后面
        const noRegexBefore = /[A-Za-z0-9_$)\]}"'`/]/
        const regexAllowed = !lastSig || !noRegexBefore.test(lastSig)
        if (c === '/' && regexAllowed) {
          state = 'regex'
          inClass = false
          continue
        }
        if ('([{'.includes(c)) stack.push(c)
        else if (')]}'.includes(c)) {
          const top = stack.pop()
          if (top !== pairs[c]) throw new Error('下标 ' + i + ' 处括号不匹配: ' + c)
        }
        if (!/\s/.test(c)) lastSig = c
      } else if (state === 'line') {
        if (c === '\n') {
          state = 'code'
          lastSig = '\n'
        }
      } else if (state === 'block') {
        if (c === '*' && next === '/') {
          state = 'code'
          i += 1
        }
      } else if (state === 'regex') {
        if (c === '\\') {
          i += 1
          continue
        }
        if (c === '\n') throw new Error('正则字面量没有闭合')
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) state = 'code'
      } else {
        // 普通字符串
        if (c === '\\') {
          i += 1
          continue
        }
        if (c === state) state = 'code'
      }
    }
    if (state !== 'code') throw new Error('文件结束时仍在 ' + state + ' 状态（引号/注释/正则没闭合）')
    if (stack.length) throw new Error('还有未闭合的 ' + stack.join(''))
  })

  check('CSS 花括号配平: ' + rel, () => {
    const styleBlocks = src.match(/\/\* css \*\/\s*`([\s\S]*?)`/g) || []
    for (const block of styleBlocks) {
      const open = (block.match(/{/g) || []).length
      const close = (block.match(/}/g) || []).length
      if (open !== close) throw new Error('CSS 花括号不配平 ' + open + ' vs ' + close)
    }
  })
}

check('index.html 引用的本地文件都存在', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1])
  if (!refs.length) throw new Error('没有找到任何本地资源引用')
  for (const ref of refs) {
    const target = path.join(root, ref.replace(/^\.\//, ''))
    if (!fs.existsSync(target)) throw new Error('引用的文件不存在: ' + ref)
  }
  if (!refs.some((r) => r.includes('vue.global.prod.js'))) throw new Error('没有引用 Vue')
  if (!refs.some((r) => r.includes('main.js'))) throw new Error('没有引用 main.js')
})

check('所有 JS 里的相对 import 都能解析到真实文件', () => {
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, 'utf8')
    const imports = [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
    for (const spec of imports) {
      const target = path.resolve(path.dirname(file), spec)
      if (!fs.existsSync(target)) {
        throw new Error(path.relative(root, file) + ' 里 import 了不存在的文件: ' + spec)
      }
    }
  }
})

check('每个组件都导出了 template 和 style', () => {
  const dir = path.join(root, 'src', 'components')
  const list = fs.readdirSync(dir)
  if (list.length < 5) throw new Error('组件数量不对: ' + list.length)
  for (const name of list) {
    const src = fs.readFileSync(path.join(dir, name), 'utf8')
    if (!src.includes('template: /* html */')) throw new Error(name + ' 缺少 template')
    if (!src.includes('style: /* css */')) throw new Error(name + ' 缺少 style')
    if (!/name:\s*'[A-Za-z]+'/.test(src)) throw new Error(name + ' 缺少 name')
  }
})

check('package.json 是合法 JSON 且脚本指向真实文件', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  for (const [key, cmd] of Object.entries(pkg.scripts || {})) {
    const m = cmd.match(/node\s+(\S+)/)
    if (m && !fs.existsSync(path.join(root, m[1]))) {
      throw new Error('脚本 ' + key + ' 指向的文件不存在: ' + m[1])
    }
  }
})

check('index.html 里阻止了直接双击打开导致的「白屏」', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  if (!html.includes("location.protocol === 'file:'")) {
    throw new Error('没有检测 file:// 协议，双击打开会白屏且没有任何提示')
  }
  if (!html.includes('npm start') || !html.includes('http://localhost:5173/')) {
    throw new Error('提示语里没有告诉用户正确的打开方式')
  }
  // 这段守卫脚本必须能在「正常 http 打开」时安静地什么都不做
  const script = html.match(/<script>([\s\S]*?)<\/script>/)
  if (!script) throw new Error('找不到内联守卫脚本')
  const run = new Function('location', 'document', script[1])
  let touched = false
  run(
    { protocol: 'https:' },
    {
      get documentElement() {
        touched = true
        return { innerHTML: '' }
      }
    }
  )
  if (touched) throw new Error('正常 https 打开时不应该改动页面')
})

check('部署时需要的文件都在（Cloudflare Pages / GitHub Pages 直接上传）', () => {
  const required = ['index.html', 'vendor/vue.global.prod.js', 'src/main.js', 'README.md']
  for (const f of required) {
    if (!fs.existsSync(path.join(root, f))) throw new Error('缺少 ' + f)
  }
  // 所有 src 下的文件都必须被上传（否则线上会 404），这里确认它们都在项目目录里
  const srcFiles = walk(path.join(root, 'src')).map((f) => path.relative(root, f))
  if (srcFiles.length < 9) throw new Error('src 下的文件数量不对: ' + srcFiles.length)
})

check('没有把 node_modules / dist 之类的产物混进项目', () => {
  for (const junk of ['node_modules', 'dist', '.npm-cache']) {
    if (fs.existsSync(path.join(root, junk))) throw new Error('存在多余的目录: ' + junk)
  }
})

console.log('\n合计: ' + pass + ' 通过, ' + fail + ' 失败')
if (fail) process.exit(1)
console.log('结构自检全部通过 🎉\n')
