/**
 * 纯逻辑：从选项里挑出一个中奖的下标 + 计算转盘要转到哪个角度。
 * 抽出来单独放，是为了能脱离浏览器用 node --test 做自检。
 */

/** 把任意输入揉成一个 >= 0 的权重数字 */
export function normalizeWeight(weight, fallback = 1) {
  const n = Number(weight)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

/**
 * 按权重随机挑一个下标。
 * @param {Array<{weight?: number}>} items
 * @param {() => number} rng 返回 [0,1) 的随机数，默认 Math.random
 * @returns {number} 下标，items 为空时返回 -1
 */
export function pickWeightedIndex(items, rng = Math.random) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return -1

  const weights = list.map((it) => normalizeWeight(it && it.weight, 1))
  const total = weights.reduce((a, b) => a + b, 0)

  // 全是 0（或者都不是数字）就退化成等概率
  if (!(total > 0)) return Math.floor(rng() * list.length) % list.length

  let ticket = rng() * total
  for (let i = 0; i < weights.length; i += 1) {
    ticket -= weights[i]
    if (ticket < 0) return i
  }
  // 浮点误差兜底
  return weights.length - 1
}

/** 等概率随机挑一个下标 */
export function pickUniformIndex(length, rng = Math.random) {
  if (!Number.isInteger(length) || length <= 0) return -1
  const i = Math.floor(rng() * length)
  return i >= length ? length - 1 : i
}

/**
 * 统一的入口：mode 为 'weighted' 时按权重，为 'uniform' 时等概率。
 * 返回中奖选项对象（含 index），空列表返回 null。
 */
export function pickWinner(items, mode = 'weighted', rng = Math.random) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return null
  const index =
    mode === 'uniform' ? pickUniformIndex(list.length, rng) : pickWeightedIndex(list, rng)
  return { index, item: list[index] }
}

/** 洗一个 [0, length) 的随机序列（用于开局打乱菜品顺序） */
export function shuffledIndices(length, rng = Math.random) {
  const arr = Array.from({ length: Math.max(0, length) }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export const TAU = Math.PI * 2

/** 把角度归一化到 [0, 2π) */
export function normalizeAngle(angle) {
  return ((angle % TAU) + TAU) % TAU
}

/**
 * 扇区 i 的角平分线方向（用 canvas 的 atan2 约定：0 指向右，顺时针为正）。
 * 指针固定在正上方，canvas 里「正上方」是 -π/2。
 */
export function segmentMidAngle(index, segmentCount) {
  return (index + 0.5) * (TAU / Math.max(1, segmentCount))
}

/**
 * 计算一次转动：从 currentRotation 出发，最终停在 segmentIndex 的扇区里。
 * 纯函数，方便自检。
 * @returns {{ targetRotation: number, delta: number }}
 */
export function buildSpin(
  segmentIndex,
  segmentCount,
  currentRotation = 0,
  { turns = 6, jitter = 0.62, rng = Math.random } = {}
) {
  const n = Math.max(1, segmentCount | 0)
  const idx = Math.max(0, Math.min(n - 1, segmentIndex | 0))
  const segmentAngle = TAU / n

  // 让「指针(正上方)」对准 idx 的角平分线： mid + rotation ≡ -π/2
  const align = -Math.PI / 2 - segmentMidAngle(idx, n)

  // 在扇区里随机偏一点点，避免每次都停在正中间，看起来不呆板
  const spread = Math.max(0, Math.min(0.9, Number(jitter) || 0)) * segmentAngle * 0.5
  const offset = (rng() * 2 - 1) * spread

  // 额外转几整圈，保证「往前转」而且是转盘该有的那种转法
  const extraTurns = Math.max(1, Number(turns) || 1) + Math.floor(rng() * 3)

  const desired = align + offset + extraTurns * TAU
  const current = Number.isFinite(currentRotation) ? currentRotation : 0

  // 取同余角度里最小的那个「大于当前角度」的值
  let delta = desired - current
  while (delta < TAU) delta += TAU

  return { targetRotation: current + delta, delta }
}

/** 常用缓动：先快后慢，停下来的手感 */
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5)
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/** 在 [min,max] 之间按 t(0~1) 插值 */
export function lerp(min, max, t) {
  return min + (max - min) * t
}
