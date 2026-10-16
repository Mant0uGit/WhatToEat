/** 转盘用的颜色、默认菜品、小工具函数 */

// 暖色系配色，和「吃饭」这个主题比较搭
export const PALETTE = [
  '#FF7A59',
  '#FFB703',
  '#4CC9A7',
  '#5AA9F5',
  '#B37FEB',
  '#FF9CC2',
  '#7ED957',
  '#FF6B6B',
  '#43C6DB',
  '#F4A261',
  '#8D99AE',
  '#C77DFF'
]

export const DEFAULT_DISHES = [
  '麻辣烫',
  '兰州拉面',
  '黄焖鸡米饭',
  '麦当劳',
  '小笼包',
  '沙县小吃',
  '火锅',
  '烤肉',
  '螺蛳粉',
  '寿司',
  '炸鸡',
  '盖浇饭',
  '酸菜鱼',
  '粥 + 小菜',
  '饺子',
  '随便点外卖'
]

export const STORAGE_KEY = 'what-to-eat-wheel:v1'

let seq = 0
export function makeId() {
  seq += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `d${Date.now().toString(36)}${seq.toString(36)}${rand}`
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** 微信 / 手机浏览器上的震动反馈（不支持就安静地失败） */
export function haptic(pattern = 18) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* 忽略 */
  }
}

/** 极简音效：不需要任何音频文件 */
let audioCtx = null
export function tick(freq = 880, duration = 0.035, gain = 0.045) {
  try {
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const osc = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.value = gain
    osc.connect(g)
    g.connect(audioCtx.destination)
    const t0 = audioCtx.currentTime
    osc.start(t0)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.stop(t0 + duration + 0.01)
  } catch {
    /* 忽略 */
  }
}

/** 中奖小号角，两个音符 */
export function fanfare() {
  tick(660, 0.12, 0.05)
  setTimeout(() => tick(880, 0.18, 0.05), 110)
}

/** 取首字符做转盘上的短标签（emoji 会自己占一格） */
export function shortLabel(text, max = 9) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}
