/**
 * 在同一个进程里跑所有测试，输出 ✅/❌。
 * `node --test` 需要为每个文件开子进程，在某些受限环境里会失败，所以额外提供这个入口。
 * 两种方式跑出来的断言是完全一样的。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const files = fs.readdirSync(here).filter((f) => f.endsWith('.test.js')).sort()

let pass = 0
let fail = 0
const failures = []

for (const file of files) {
  const mod = await import(new URL('./' + file, import.meta.url).href)
  const tests = Array.isArray(mod.default) ? mod.default : []
  console.log('\n── ' + file + ' ──')
  for (const t of tests) {
    try {
      await t.fn()
      pass += 1
      console.log('  ✅ ' + t.name)
    } catch (err) {
      fail += 1
      failures.push({ file, name: t.name, err })
      console.log('  ❌ ' + t.name)
      console.log('     ' + (err && err.message ? err.message : String(err)))
    }
  }
  if (!tests.length) console.log('  (没有测试)')
}

console.log('\n合计: ' + pass + ' 通过, ' + fail + ' 失败')
if (fail) {
  console.log('\n失败详情:')
  for (const f of failures) {
    console.log('  • [' + f.file + '] ' + f.name)
    console.log('    ' + (f.err && f.err.stack ? f.err.stack.split('\n').slice(0, 4).join('\n    ') : ''))
  }
  process.exit(1)
}
console.log('全部通过 🎉')
