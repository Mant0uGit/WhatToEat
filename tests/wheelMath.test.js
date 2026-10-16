import { assert, defineTests } from './harness.mjs'

import {
  normalizeWeight,
  pickWeightedIndex,
  pickUniformIndex,
  pickWinner,
  shuffledIndices,
  buildSpin,
  segmentMidAngle,
  normalizeAngle,
  TAU
} from '../src/utils/wheelMath.js'

/** 简单可复现的随机数发生器，便于断言 */
function seeded(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export default defineTests([
  [
    'normalizeWeight 处理异常输入',
    () => {
      assert.equal(normalizeWeight(3), 3)
      assert.equal(normalizeWeight(0), 0)
      assert.equal(normalizeWeight(-5), 1)
      assert.equal(normalizeWeight('2.5'), 2.5)
      assert.equal(normalizeWeight(undefined), 1)
      assert.equal(normalizeWeight(NaN), 1)
    }
  ],
  [
    'pickWeightedIndex 单元素列表永远返回 0',
    () => {
      const rng = seeded(7)
      for (let i = 0; i < 50; i += 1) assert.equal(pickWeightedIndex([{ weight: 1 }], rng), 0)
    }
  ],
  [
    'pickWeightedIndex 空列表返回 -1',
    () => {
      assert.equal(pickWeightedIndex([], seeded(3)), -1)
      assert.equal(pickWeightedIndex(null, seeded(3)), -1)
    }
  ],
  [
    'pickWeightedIndex 不会选中权重为 0 的项',
    () => {
      const items = [{ weight: 1 }, { weight: 0 }, { weight: 1 }]
      const rng = seeded(11)
      for (let i = 0; i < 400; i += 1) assert.notEqual(pickWeightedIndex(items, rng), 1)
    }
  ],
  [
    'pickWeightedIndex 权重比例大致正确（1:9）',
    () => {
      const items = [{ weight: 9 }, { weight: 1 }]
      const rng = seeded(2024)
      const N = 20000
      let first = 0
      for (let i = 0; i < N; i += 1) if (pickWeightedIndex(items, rng) === 0) first += 1
      const ratio = first / N
      assert.ok(ratio > 0.85 && ratio < 0.95, '实际比例 ' + ratio + ' 应该接近 0.9')
    }
  ],
  [
    '全 0 权重退化成等概率而不是崩溃',
    () => {
      const items = [{ weight: 0 }, { weight: 0 }, { weight: 0 }]
      const rng = seeded(5)
      const seen = new Set()
      for (let i = 0; i < 300; i += 1) seen.add(pickWeightedIndex(items, rng))
      assert.deepEqual([...seen].sort(), [0, 1, 2])
    }
  ],
  [
    'pickWeightedIndex 返回值永远是合法下标',
    () => {
      const rng = seeded(99)
      const items = [{ weight: 0.2 }, { weight: 5 }, { weight: 0 }, { weight: 1 }, { weight: 3 }]
      for (let i = 0; i < 5000; i += 1) {
        const idx = pickWeightedIndex(items, rng)
        assert.ok(Number.isInteger(idx) && idx >= 0 && idx < items.length, '非法下标 ' + idx)
      }
    }
  ],
  [
    'pickUniformIndex 覆盖全部下标且不越界',
    () => {
      const rng = seeded(42)
      const seen = new Set()
      for (let i = 0; i < 3000; i += 1) {
        const idx = pickUniformIndex(4, rng)
        assert.ok(idx >= 0 && idx < 4)
        seen.add(idx)
      }
      assert.equal(seen.size, 4)
      assert.equal(pickUniformIndex(0, rng), -1)
    }
  ],
  [
    'pickWinner 空列表返回 null，否则返回对应项',
    () => {
      assert.equal(pickWinner([], 'weighted', seeded(1)), null)
      const items = [{ name: 'a', weight: 1 }, { name: 'b', weight: 1 }]
      const w = pickWinner(items, 'uniform', seeded(9))
      assert.ok(w && [0, 1].includes(w.index))
      assert.equal(w.item, items[w.index])
    }
  ],
  [
    'shuffledIndices 是合法排列',
    () => {
      const rng = seeded(123)
      for (const n of [0, 1, 2, 7, 40]) {
        const arr = shuffledIndices(n, rng)
        assert.equal(arr.length, n)
        assert.deepEqual([...arr].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i))
      }
    }
  ],
  [
    'buildSpin 把中奖扇区转到正上方的指针下',
    () => {
      const rng = seeded(777)
      for (const n of [2, 3, 5, 8, 16, 40]) {
        for (let idx = 0; idx < n; idx += 1) {
          for (let round = 0; round < 6; round += 1) {
            const { targetRotation } = buildSpin(idx, n, round * 3.7, { turns: 6, jitter: 0.6, rng })
            const after = normalizeAngle(segmentMidAngle(idx, n) + targetRotation)
            const target = normalizeAngle(-Math.PI / 2)
            let diff = Math.abs(after - target)
            if (diff > Math.PI) diff = TAU - diff
            const half = TAU / n / 2
            assert.ok(diff <= half + 1e-9, 'n=' + n + ' idx=' + idx + ' 偏差 ' + diff + ' > 半个扇区 ' + half)
          }
        }
      }
    }
  ],
  [
    'buildSpin 永远往前转，且至少一整圈',
    () => {
      const rng = seeded(31337)
      for (const n of [2, 6, 12, 40]) {
        let rot = 0
        for (let i = 0; i < 200; i += 1) {
          const idx = pickUniformIndex(n, rng)
          const { targetRotation, delta } = buildSpin(idx, n, rot, { turns: 6, jitter: 0.6, rng })
          assert.ok(delta >= TAU, 'delta=' + delta + ' 至少要转一整圈')
          assert.ok(targetRotation > rot, '必须递增，不能倒着转')
          rot = targetRotation
        }
        assert.ok(Number.isFinite(rot))
      }
    }
  ],
  [
    'buildSpin 处理边界参数（1 个扇区 / 负数角度 / 0 个扇区）',
    () => {
      const rng = seeded(4)
      const a = buildSpin(0, 1, 0, { rng })
      assert.ok(Number.isFinite(a.targetRotation) && a.delta > 0)
      const b = buildSpin(-3, 5, -10, { rng })
      assert.ok(b.targetRotation > -10)
      const c = buildSpin(2, 0, 0, { rng })
      assert.ok(Number.isFinite(c.targetRotation))
    }
  ],
  [
    'jitter=0 时正好停在扇区正中间',
    () => {
      const rng = seeded(8)
      const n = 9
      const { targetRotation } = buildSpin(3, n, 0, { jitter: 0, turns: 5, rng })
      const after = normalizeAngle(segmentMidAngle(3, n) + targetRotation)
      const target = normalizeAngle(-Math.PI / 2)
      let diff = Math.abs(after - target)
      if (diff > Math.PI) diff = TAU - diff
      assert.ok(diff < 1e-9, '偏差 ' + diff)
    }
  ],
  [
    'normalizeAngle 归一化到 [0, 2π)',
    () => {
      assert.ok(Math.abs(normalizeAngle(0) - 0) < 1e-12)
      assert.ok(Math.abs(normalizeAngle(TAU) - 0) < 1e-12)
      assert.ok(Math.abs(normalizeAngle(-Math.PI / 2) - (TAU - Math.PI / 2)) < 1e-12)
      assert.ok(Math.abs(normalizeAngle(TAU * 7.5) - Math.PI) < 1e-12)
    }
  ]
])
