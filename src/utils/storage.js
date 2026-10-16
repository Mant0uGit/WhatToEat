/** localStorage 读写：坏了 / 被清了 / 隐私模式，都不能让页面崩 */

import { STORAGE_KEY, DEFAULT_DISHES, makeId, clamp } from './constants.js'

export function normalizeItem(raw) {
  if (raw == null) return null
  // 兼容「直接存字符串」的老数据
  const obj = typeof raw === 'string' ? { name: raw } : raw
  const name = String(obj.name ?? obj.label ?? '').trim()
  if (!name) return null
  const weight = Number(obj.weight)
  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : makeId(),
    name: name.slice(0, 40),
    weight: Number.isFinite(weight) ? clamp(weight, 0, 99) : 1
  }
}

export function normalizeItems(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const item = normalizeItem(raw)
    if (!item) continue
    // 同名去重，避免转盘上出现两个一样的
    const key = item.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out.slice(0, 60)
}

export function defaultItems() {
  return normalizeItems(DEFAULT_DISHES.map((name) => ({ name, weight: 1 })))
}

export function loadState() {
  const fallback = { items: defaultItems(), mode: 'weighted', sound: true }
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const items = normalizeItems(parsed?.items)
    return {
      items: items.length ? items : fallback.items,
      mode: parsed?.mode === 'uniform' ? 'uniform' : 'weighted',
      sound: parsed?.sound !== false
    }
  } catch {
    return fallback
  }
}

export function saveState(state) {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        items: normalizeItems(state?.items),
        mode: state?.mode === 'uniform' ? 'uniform' : 'weighted',
        sound: state?.sound !== false
      })
    )
    return true
  } catch {
    // 微信隐私模式 / 存储写满 都可能抛错，静默处理
    return false
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略 */
  }
}
