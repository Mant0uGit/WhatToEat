import { assert, defineTests } from './harness.mjs'
import { normalizeItem, normalizeItems, defaultItems } from '../src/utils/storage.js'

export default defineTests([
  [
    'normalizeItem 兼容字符串与对象两种写法',
    () => {
      const fromString = normalizeItem('火锅')
      assert.equal(fromString.name, '火锅')
      assert.equal(fromString.weight, 1)
      assert.equal(typeof fromString.id, 'string')
      assert.ok(fromString.id.length > 0)

      const obj = normalizeItem({ name: '烤肉', weight: 3 })
      assert.equal(obj.name, '烤肉')
      assert.equal(obj.weight, 3)
      assert.ok(typeof obj.id === 'string' && obj.id.length > 0)
    }
  ],
  [
    'normalizeItem 丢掉空名字',
    () => {
      assert.equal(normalizeItem(''), null)
      assert.equal(normalizeItem('   '), null)
      assert.equal(normalizeItem(null), null)
      assert.equal(normalizeItem({ name: '' }), null)
      assert.equal(normalizeItem(123), null)
    }
  ],
  [
    'normalizeItem 会把权重夹到 0~99',
    () => {
      assert.equal(normalizeItem({ name: 'a', weight: -4 }).weight, 0)
      assert.equal(normalizeItem({ name: 'b', weight: 999 }).weight, 99)
      assert.equal(normalizeItem({ name: 'c', weight: 'x' }).weight, 1)
    }
  ],
  [
    'normalizeItem 截断超长名字',
    () => {
      assert.equal(normalizeItem('一'.repeat(80)).name.length, 40)
    }
  ],
  [
    'normalizeItems 去重、过滤并限制数量',
    () => {
      const list = normalizeItems(['火锅', '火锅', '', null, '烤肉'])
      assert.deepEqual(list.map((i) => i.name), ['火锅', '烤肉'])
      const many = normalizeItems(Array.from({ length: 200 }, (_, i) => '菜' + i))
      assert.equal(many.length, 60)
    }
  ],
  [
    'normalizeItems 输入不是数组时返回空数组',
    () => {
      assert.deepEqual(normalizeItems(undefined), [])
      assert.deepEqual(normalizeItems({ a: 1 }), [])
    }
  ],
  [
    'defaultItems 是一份可用的默认菜单',
    () => {
      const list = defaultItems()
      assert.ok(list.length >= 6)
      assert.ok(list.every((i) => i.name && i.weight === 1 && i.id))
      const names = new Set(list.map((i) => i.name))
      assert.equal(names.size, list.length, '默认菜单里不应该有重名')
    }
  ]
])
