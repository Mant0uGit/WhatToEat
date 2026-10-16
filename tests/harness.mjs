/**
 * 极简测试小工具：不依赖任何第三方库。
 *
 * 用法：
 *   node tests/run.mjs        # 单进程跑，输出 ✅/❌（推荐，受限环境也能跑）
 *   npm test                  # 等价于上面那条
 *
 * 每个 *.test.js 默认导出 [{ name, fn }, ...]，其中 fn 抛出异常即视为失败。
 */
import assert from 'node:assert/strict'

export { assert }

/** 定义一组用例：cases 是 [名称, 函数] 的数组 */
export function defineTests(cases) {
  return cases.map(([name, fn]) => ({ name, fn }))
}
