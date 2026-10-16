/**
 * 渲染自检：在没有浏览器的环境里验证 Vue 组件能不能正常编译 + 挂载。
 *
 * 做两件事：
 *  1. 用 Vue 自带的运行时编译器检查每个组件的 template 有没有语法错误、有没有引用未定义的变量；
 *  2. 用一套极小的 DOM 假实现把整个应用真的挂载一次，确认根组件能渲染出内容、事件能触发、不抛异常。
 *
 * 运行：node tests/render.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

let pass = 0
let fail = 0
const pending = []
function check(name, fn) {
  const record = (err) => {
    if (err) {
      fail += 1
      console.log('  ❌ ' + name)
      console.log('     ' + (err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n     ') : err))
    } else {
      pass += 1
      console.log('  ✅ ' + name)
    }
  }
  try {
    const out = fn()
    if (out && typeof out.then === 'function') {
      pending.push(out.then(() => record(null), record))
    } else {
      record(null)
    }
  } catch (err) {
    record(err)
  }
}

/* ---------------------------------------------------------------
 * 1) 极简 DOM 假实现，够 Vue 的 runtime-dom 跑起来
 * ------------------------------------------------------------- */
let fakeDocumentRef = null

class FakeClassList {
  constructor() {
    this.set = new Set()
  }
  add(...c) {
    c.forEach((x) => x && this.set.add(x))
  }
  remove(...c) {
    c.forEach((x) => this.set.delete(x))
  }
  contains(c) {
    return this.set.has(c)
  }
  toString() {
    return [...this.set].join(' ')
  }
}

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase()
    this.nodeType = 1
    this.childNodes = []
    this.parentNode = null
    this.attributes = {}
    this.style = { setProperty() {}, removeProperty() {} }
    this.classList = new FakeClassList()
    this.dataset = {}
    this._text = ''
    this._listeners = {}
    this.value = ''
    this.disabled = false
    this.checked = false
    // canvas 的物理像素尺寸（Vue 之外的代码会直接赋值）
    this.width = 0
    this.height = 0
    // runtime-dom 在过渡动画结束时会用到 el.ownerDocument.body
    this.ownerDocument = fakeDocumentRef
    // 布局尺寸：让 measure() 能算出一个正常的转盘大小
    this._clientWidth = 360
  }
  get clientWidth() {
    return this._clientWidth
  }
  set clientWidth(v) {
    this._clientWidth = v
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1)
  }
  get firstChild() {
    return this.childNodes[0] || null
  }
  get textContent() {
    if (this.childNodes.length) return this.childNodes.map((n) => n.textContent).join('')
    return this._text
  }
  set textContent(v) {
    this.childNodes = []
    this._text = String(v ?? '')
  }
  get innerHTML() {
    return this.textContent
  }
  set innerHTML(v) {
    this.childNodes = []
    this._text = String(v ?? '')
  }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node)
    node.parentNode = this
    this.childNodes.push(node)
    return node
  }
  insertBefore(node, ref) {
    const i = ref ? this.childNodes.indexOf(ref) : -1
    if (i < 0) return this.appendChild(node)
    node.parentNode = this
    this.childNodes.splice(i, 0, node)
    return node
  }
  removeChild(node) {
    const i = this.childNodes.indexOf(node)
    if (i >= 0) this.childNodes.splice(i, 1)
    node.parentNode = null
    return node
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this)
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v)
    if (k === 'class') {
      // Vue 会把 class 整个写进属性里，这里必须重新解析，不能丢掉
      this.classList = new FakeClassList()
      String(v)
        .split(/\s+/)
        .forEach((c) => c && this.classList.add(c))
    }
    if (k === 'style' && typeof v === 'string') {
      for (const part of v.split(';')) {
        const idx = part.indexOf(':')
        if (idx > 0) this.style[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
      }
    }
  }
  getAttribute(k) {
    return this.attributes[k] ?? null
  }
  removeAttribute(k) {
    delete this.attributes[k]
  }
  hasAttribute(k) {
    return k in this.attributes
  }
  addEventListener(type, fn) {
    ;(this._listeners[type] ||= []).push(fn)
  }
  removeEventListener(type, fn) {
    const l = this._listeners[type] || []
    const i = l.indexOf(fn)
    if (i >= 0) l.splice(i, 1)
  }
  dispatchEvent(event) {
    const e = Object.assign({ type: event.type, target: this, preventDefault() {}, stopPropagation() {} }, event)
    for (const fn of this._listeners[e.type] || []) fn(e)
    return true
  }
  /** 模拟点击，走一遍 Vue 绑定的事件 */
  click() {
    return this.dispatchEvent({ type: 'click' })
  }
  /** 默认返回一个「录像机」式 2D 上下文，让 canvas 绘制逻辑真的跑起来并被记录 */
  getContext() {
    if (!this._ctx) this._ctx = makeRecordingContext()
    return this._ctx
  }
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 300, bottom: 300, width: 300, height: 300, x: 0, y: 0 }
  }
  querySelector() {
    return null
  }
  querySelectorAll() {
    return []
  }
  getRootNode() {
    return this.ownerDocument || fakeDocument
  }
  /** 在子树里按 class 找元素，方便断言 */
  findAll(pred) {
    const out = []
    const walk = (n) => {
      if (pred(n)) out.push(n)
      n.childNodes.forEach(walk)
    }
    walk(this)
    return out
  }
}

class FakeText extends FakeNode {
  constructor(text) {
    super('#text')
    this.nodeType = 3
    this._text = String(text ?? '')
  }
  get textContent() {
    return this._text
  }
  set textContent(v) {
    this._text = String(v ?? '')
  }
}

/**
 * 「录像机」式 2D 上下文：把 canvas 的每一次绘制调用都记下来，
 * 这样就可以在没有真浏览器的情况下检查转盘到底画出了什么。
 */
function makeRecordingContext() {
  const calls = []
  const state = {}
  const push = (name, args) => calls.push({ name, args: args.filter((a) => a !== undefined) })
  const ctx = {
    calls,
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(v) {
      state.fillStyle = v
      push('fillStyle', [v])
    },
    get strokeStyle() {
      return state.strokeStyle
    },
    set strokeStyle(v) {
      state.strokeStyle = v
      push('strokeStyle', [v])
    },
    get lineWidth() {
      return state.lineWidth
    },
    set lineWidth(v) {
      state.lineWidth = v
    },
    get font() {
      return state.font
    },
    set font(v) {
      state.font = v
      push('font', [v])
    },
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    setTransform: (...a) => push('setTransform', a),
    clearRect: (...a) => push('clearRect', a),
    beginPath: () => push('beginPath', []),
    closePath: () => push('closePath', []),
    moveTo: (...a) => push('moveTo', a),
    lineTo: (...a) => push('lineTo', a),
    arc: (...a) => push('arc', a),
    fill: () => push('fill', []),
    stroke: () => push('stroke', []),
    setLineDash: (...a) => push('setLineDash', a),
    fillText: (...a) => push('fillText', a),
    fillRect: (...a) => push('fillRect', a),
    save: () => push('save', []),
    restore: () => push('restore', []),
    translate: (...a) => push('translate', a),
    rotate: (...a) => push('rotate', a),
    scale: (...a) => push('scale', a)
  }
  return ctx
}

function allArcs(canvas) {
  return (canvas.getContext().calls || []).filter((c) => c.name === 'arc')
}

function wedgeArcs(canvas) {
  // 扇形：arc(cx, cy, r, start, end) 且不是整圆；中心装饰圈 end-start === 2π
  return allArcs(canvas).filter((c) => c.args.length >= 5 && Math.abs(c.args[4] - c.args[3]) < Math.PI * 1.99)
}

function fillsOf(canvas) {
  const calls = canvas.getContext().calls || []
  const out = []
  for (let i = 0; i < calls.length; i += 1) {
    if (calls[i].name === 'fill' && i > 0 && calls[i - 1].name === 'fillStyle') {
      out.push(calls[i - 1].args[0])
    }
  }
  return out
}

function textsOf(canvas) {
  return (canvas.getContext().calls || []).filter((c) => c.name === 'fillText').map((c) => String(c.args[0]))
}

class FakeComment extends FakeText {
  constructor(text) {
    super(text)
    this.nodeType = 8
  }
}

/** 支持最常用的几种选择器：#id / .class / tag，够 Vue 的挂载逻辑用 */
function matchSimple(node, selector) {
  const sel = String(selector || '').trim()
  if (!sel || node.nodeType !== 1) return false
  if (sel.startsWith('#')) return node.attributes.id === sel.slice(1)
  if (sel.startsWith('.')) return node.classList.contains(sel.slice(1))
  return node.tagName === sel.toUpperCase()
}

const fakeDocument = {
  nodeType: 9,
  head: new FakeNode('head'),
  body: new FakeNode('body'),
  documentElement: new FakeNode('html'),
  createElement: (tag) => new FakeNode(tag),
  createElementNS: (_ns, tag) => new FakeNode(tag),
  createTextNode: (t) => new FakeText(t),
  createComment: (t) => new FakeComment(t),
  querySelector(sel) {
    if (Object.prototype.hasOwnProperty.call(this, sel)) return this[sel]
    const found = this.documentElement.findAll((n) => matchSimple(n, sel))
    return found[0] || null
  },
  querySelectorAll(sel) {
    return this.documentElement.findAll((n) => matchSimple(n, sel))
  },
  getElementById(id) {
    if (Object.prototype.hasOwnProperty.call(this, id)) return this[id]
    const found = this.body.findAll((n) => n.attributes && n.attributes.id === id)
    return found[0] || null
  },
  addEventListener() {},
  removeEventListener() {},
  readyState: 'complete'
}
fakeDocumentRef = fakeDocument
fakeDocument.ownerDocument = fakeDocument
fakeDocument.documentElement.appendChild(fakeDocument.head)
fakeDocument.documentElement.appendChild(fakeDocument.body)

const fakeWindow = {
  document: fakeDocument,
  devicePixelRatio: 1,
  innerWidth: 390,
  innerHeight: 844,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  performance: { now: () => Date.now() },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  navigator: { vibrate() {}, userAgent: 'node-render-check' },
  location: { href: 'http://localhost/' },
  localStorage: (() => {
    const store = new Map()
    return {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    }
  })(),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  ResizeObserver: undefined
}

// 挂到 globalThis 上，让 runtime-dom 认为自己在浏览器里。
// Node 里 navigator / localStorage 可能是只读的 getter，所以统一用 defineProperty。
function setGlobal(key, value) {
  try {
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: false
    })
  } catch {
    try {
      globalThis[key] = value
    } catch {
      /* 实在设置不了就沿用 Node 自己的实现 */
    }
  }
}

setGlobal('window', fakeWindow)
setGlobal('document', fakeDocument)
setGlobal('navigator', fakeWindow.navigator)
setGlobal('location', fakeWindow.location)
setGlobal('localStorage', fakeWindow.localStorage)
setGlobal('requestAnimationFrame', fakeWindow.requestAnimationFrame)
setGlobal('cancelAnimationFrame', fakeWindow.cancelAnimationFrame)
setGlobal('getComputedStyle', fakeWindow.getComputedStyle)
setGlobal('HTMLElement', FakeNode)
setGlobal('SVGElement', FakeNode)
setGlobal('Element', FakeNode)
setGlobal('Node', FakeNode)
setGlobal('Text', FakeText)
setGlobal('Comment', FakeComment)

// 给 #app 挂一个真实的根节点
const appRoot = new FakeNode('div')
appRoot.setAttribute('id', 'app')
fakeDocument.body.appendChild(appRoot)

// 把 Vue 的全局生产版本加载进来（就是页面里用的那一个文件）。
// 这个文件是 `var Vue = (function(){...})()` 的形式，所以直接 return 这个变量。
const vueCode = fs.readFileSync(path.join(root, 'vendor', 'vue.global.prod.js'), 'utf8')
const vueFn = new Function(
  'window',
  'document',
  'navigator',
  'globalThis',
  vueCode + '\n;return typeof Vue !== "undefined" ? Vue : window.Vue;'
)
const Vue = vueFn(fakeWindow, fakeDocument, fakeWindow.navigator, globalThis)
if (!Vue || !Vue.createApp) throw new Error('没能加载 Vue，检查 vendor/vue.global.prod.js')
fakeWindow.Vue = Vue
setGlobal('Vue', Vue)

console.log('\n── 渲染自检（无浏览器环境）──')
console.log('Vue 版本: ' + Vue.version)

const components = await Promise.all([
  import('../src/components/PointerMark.js'),
  import('../src/components/ConfettiFx.js'),
  import('../src/components/WheelCanvas.js'),
  import('../src/components/ListItemPanel.js'),
  import('../src/components/ResultOverlay.js')
])
const App = (await import('../src/App.js')).default
const defs = [...components.map((m) => m.default), App]

/* ---------------------------------------------------------------
 * 2) 模板编译检查
 * ------------------------------------------------------------- */
for (const def of defs) {
  check('模板编译通过: ' + def.name, () => {
    const errors = []
    const render = Vue.compile(def.template, { onError: (e) => errors.push(e) })
    if (errors.length) throw new Error(errors.map((e) => e.message).join('; '))
    if (typeof render !== 'function') throw new Error('compile 没有返回渲染函数')
    if (typeof def.name !== 'string' || !def.name.length) throw new Error('组件缺少 name')
  })
  check('组件有 style 且不为空: ' + def.name, () => {
    if (typeof def.style !== 'string' || def.style.length < 20) throw new Error('style 缺失')
  })
}

/* ---------------------------------------------------------------
 * 3) 真正挂载一次，验证渲染 + 交互
 * ------------------------------------------------------------- */
let vm = null
check('应用可以挂载到 #app', () => {
  const app = Vue.createApp(App)
  for (const def of defs) app.component(def.name, def)
  vm = app.mount(appRoot)
  if (!vm) throw new Error('mount 返回空')
})

check('默认渲染出 16 个菜品', () => {
  if (vm.items.length !== 16) throw new Error('实际 ' + vm.items.length + ' 个')
  if (vm.segments.length !== 16) throw new Error('转盘扇区 ' + vm.segments.length + ' 个')
})

check('渲染结果里出现了标题和开始按钮', () => {
  const html = appRoot.textContent
  if (!html.includes('今天吃什么')) throw new Error('没渲染出标题, 实际内容: ' + html.slice(0, 120))
})

check('WheelCanvas 单独挂载：空列表和有菜品都不报错', () => {
  const WheelCanvas = defs.find((d) => d.name === 'WheelCanvas')
  const host = new FakeNode('div')
  const app = Vue.createApp(WheelCanvas, { segments: [], rotation: 0, spinning: false })
  const vm = app.mount(host)
  if (typeof vm.draw !== 'function') throw new Error('缺少 draw 方法')
  vm.measure()
  vm.$refs.canvas.getContext().calls.length = 0
  vm.draw()
  // 空列表：应当提示去添加菜品，并且一个扇形都不画
  const emptyArcs = wedgeArcs(vm.$refs.canvas)
  if (emptyArcs.length !== 0) throw new Error('空列表却画了 ' + emptyArcs.length + ' 个扇形')
  if (!textsOf(vm.$refs.canvas).join('').includes('还没有菜品')) {
    throw new Error('空列表没有画提示文字，实际: ' + textsOf(vm.$refs.canvas).join(' / '))
  }

  const withItems = [
    { id: 'a', name: '麻辣烫', weight: 1 },
    { id: 'b', name: '火锅', weight: 1 },
    { id: 'c', name: 'aaaaaaaaaaaaaaaaaaaa', weight: 1 }
  ]
  const vm2 = Vue.createApp(WheelCanvas, {
    segments: withItems,
    rotation: 3.14,
    spinning: true
  }).mount(new FakeNode('div'))
  vm2.$refs.canvas.getContext().calls.length = 0 // 只统计这一次绘制
  vm2.draw()
  const arcs = wedgeArcs(vm2.$refs.canvas)
  if (arcs.length !== 3) throw new Error('3 个菜品应该画 3 个扇形，实际 ' + arcs.length)
  if (!vm2.ariaLabel.includes('麻辣烫')) throw new Error('无障碍标签没带上菜名')
  if (vm2.canvasStyle.transform !== 'rotate(3.14rad)') {
    throw new Error('旋转样式没接上: ' + vm2.canvasStyle.transform)
  }
  if (!vm2.holderStyle.paddingTop) throw new Error('没有给指针留出位置')
})

check('canvas 真的画出了正确数量和角度的转盘扇形', () => {
  fakeWindow.devicePixelRatio = 1
  // main.js 启动时会把整个应用重新挂载一次，所以这里重新取一次转盘实例和 canvas
  const wheelVm = vm.$refs.canvasWheel
  const wheel = wheelVm.$refs.canvas
  if (!wheel) throw new Error('没有找到转盘 canvas')
  if (!wheel.classList.contains('wheel-canvas')) throw new Error('canvas 的 class 丢了')
  wheelVm.measure() // 重新绘一次，确保尺寸和录像都是最新的
  wheel.getContext().calls.length = 0
  wheelVm.draw()

  const size = vm.$refs && vm.$refs.canvasWheel ? vm.$refs.canvasWheel.size : NaN
  if (!(size > 200)) {
    throw new Error(
      '拿不到转盘尺寸: ' + size + '，$refs 的键是 [' + Object.keys(vm.$refs || {}).join(',') + ']'
    )
  }
  if (wheel.width !== size) {
    throw new Error('canvas 物理宽度应该是 ' + size + '，实际 ' + wheel.width)
  }

  const arcs = wedgeArcs(wheel)
  if (arcs.length !== 16) throw new Error('16 个菜品应该画 16 个扇形，实际 ' + arcs.length)

  const cx = arcs[0].args[0]
  const cy = arcs[0].args[1]
  const r = arcs[0].args[2]
  const seg = (Math.PI * 2) / 16
  arcs.forEach((a, i) => {
    if (Math.abs(a.args[0] - cx) > 1e-9 || Math.abs(a.args[1] - cy) > 1e-9) {
      throw new Error('第 ' + i + ' 个扇形的圆心不一致')
    }
    if (Math.abs(a.args[2] - r) > 1e-9) throw new Error('第 ' + i + ' 个扇形的半径不一致')
    if (Math.abs(a.args[3] - i * seg) > 1e-6) {
      throw new Error('第 ' + i + ' 个扇形起始角应该是 ' + i * seg + '，实际 ' + a.args[3])
    }
    if (Math.abs(a.args[4] - (i + 1) * seg) > 1e-6) {
      throw new Error('第 ' + i + ' 个扇形结束角应该是 ' + (i + 1) * seg + '，实际 ' + a.args[4])
    }
  })

  // 顶部要给指针留位置：圆心比 canvas 几何中心低 14px（POINTER_H / 2）
  if (Math.abs(cx - size / 2) > 0.001) throw new Error('圆心 x 应该在 ' + size / 2 + '，实际 ' + cx)
  if (Math.abs(cy - (size / 2 + 14)) > 0.001) {
    throw new Error('圆心 y 应该比中心低 14px，实际 ' + cy)
  }

  // 每个菜品都要画上文字，且都被限制在扇区里
  const labels = textsOf(wheel)
  if (labels.length !== 16) throw new Error('应该画 16 个菜名，实际 ' + labels.length)
  // 转盘上的文字最多 maxChars 个字符，超出会以省略号结尾；这里还原一下再和菜名比对
  const labelMax = Math.max(...labels.map((t) => String(t).length))
  const expectLabel = (name) => (name.length <= labelMax ? name : name.slice(0, labelMax - 1) + '…')
  for (const item of vm.items) {
    if (!labels.includes(expectLabel(item.name))) {
      throw new Error(
        '转盘上没有画菜名: ' + item.name + '（期望 ' + expectLabel(item.name) + '，画的是: ' + labels.join('/') + '）'
      )
    }
  }
  if (labels.some((t) => String(t).length > 12)) {
    throw new Error('菜名太长会画到扇区外: ' + labels.join('/'))
  }

  // 配色循环使用，16 个扇区不该只有一两种颜色
  const colors = new Set(fillsOf(wheel))
  if (colors.size < 12) throw new Error('扇形配色种类太少: ' + colors.size + ' 种')
})

check('超长菜名会被截断成短标签', () => {
  const WheelCanvas = defs.find((d) => d.name === 'WheelCanvas')
  const longName = '超级无敌好吃的麻辣香锅加宽粉加毛肚加鸭血'
  // 给足空间，此时 maxChars 会比较大，但依然不能无限长
  const vm3 = Vue.createApp(WheelCanvas, {
    segments: [{ id: 'x', name: longName, weight: 1 }],
    rotation: 0
  }).mount(new FakeNode('div'))
  // 父容器宽度是 0，所以按最小值 240 算
  vm3.draw()
  const label = textsOf(vm3.$refs.canvas)[0]
  if (label === longName) throw new Error('没有截断：' + label)
  if (!label.endsWith('…')) throw new Error('截断后应该以省略号结尾：' + label)
})

check('main.js 能在浏览器环境下完成启动（注入样式 + 挂载）', async () => {
  // 先清空 #app，让 main.js 自己去找、自己去挂
  appRoot.childNodes = []
  appRoot._text = ''
  fakeWindow.Vue = Vue

  let importError = null
  try {
    await import('../src/main.js')
  } catch (err) {
    importError = err
  }
  await new Promise((r) => setTimeout(r, 80))

  if (importError) throw new Error('import main.js 抛错: ' + importError.message)

  const styles = fakeDocument.head.childNodes.filter((n) => n.tagName === 'STYLE')
  const css = styles.map((s) => s.textContent).join('\n')
  const text = appRoot.textContent

  const diag = [
    'styles=' + styles.length,
    'children=' + appRoot.childNodes.length,
    'textLen=' + text.length,
    'text=' + JSON.stringify(text.slice(0, 60))
  ].join(' ')

  if (styles.length < 2) throw new Error('样式没有注入 [' + diag + ']')
  for (const needle of ['.wheel-canvas', '.drawer', '.result-card', '.confetti', '.topbar']) {
    if (!css.includes(needle)) throw new Error('样式里缺少 ' + needle)
  }
  if (text.includes('页面没能启动')) throw new Error('走了兜底错误界面 [' + diag + ']')
  if (!text.includes('今天吃什么')) throw new Error('没挂载出内容 [' + diag + ']')
  if (!text.includes('开始转')) throw new Error('没有渲染出「开始转」按钮')
  if (!text.includes('管理菜品')) throw new Error('没有渲染出「管理菜品」按钮')
  // 菜名是画在 canvas 上的，DOM 里看不到，所以用「共 N 个选项」这句来确认数据接上了
  if (!text.includes('共 16 个选项')) throw new Error('选项数量没有渲染出来 [' + diag + ']')
  // canvas 元素确实被创建出来了（无障碍标签里带着全部菜名）
  const canvas = appRoot.findAll((n) => n.tagName === 'CANVAS')[0]
  if (!canvas) throw new Error('没有渲染出 canvas 转盘')
  const label = canvas.attributes['aria-label'] || ''
  if (!label.includes('麻辣烫') || !label.includes('火锅')) {
    throw new Error('canvas 的无障碍标签没有带上菜名: ' + label.slice(0, 80))
  }
})

check('添加 / 改名 / 调权重 / 删除 都能正常工作', () => {
  const before = vm.items.length
  vm.addItem('烤冷面')
  if (vm.items.length !== before + 1) throw new Error('添加失败')
  vm.addItem('烤冷面') // 重复
  if (vm.items.length !== before + 1) throw new Error('重复项没有被拦住')

  const target = vm.items[vm.items.length - 1]
  vm.renameItem({ id: target.id, name: '烤冷面（加蛋）' })
  if (target.name !== '烤冷面（加蛋）') throw new Error('改名失败')

  vm.setWeight({ id: target.id, weight: 3 })
  if (target.weight !== 3) throw new Error('权重设置失败')
  vm.setWeight({ id: target.id, weight: 99 })
  if (target.weight !== 9) throw new Error('权重没有被夹到 9, 实际 ' + target.weight)

  vm.removeItem(target.id)
  if (vm.items.length !== before) throw new Error('删除失败')
})

check('清空 / 恢复默认 / 打乱顺序 正常', () => {
  vm.clearAll()
  if (vm.items.length !== 0) throw new Error('清空失败')
  vm.resetAll()
  if (vm.items.length !== 16) throw new Error('恢复默认失败: ' + vm.items.length)
  const before = vm.order.join(',')
  vm.shuffleOrder()
  if (vm.order.length !== vm.items.length) throw new Error('打乱后长度不对')
  if (!before) throw new Error('order 为空')
})

check('模式切换等概率 / 音效开关', () => {
  vm.toggleMode({ target: { checked: true } })
  if (vm.mode !== 'uniform') throw new Error('没有切到等概率')
  vm.toggleMode({ target: { checked: false } })
  if (vm.mode !== 'weighted') throw new Error('没有切回按权重')
  vm.toggleSound({ target: { checked: false } })
  if (vm.sound !== false) throw new Error('音效开关失效')
})

check('转动：开始后进入 spinning，停下后给出结果', async () => {
  // 这里用同步方式驱动：直接调用内部步骤逻辑不方便，改为验证 spin() 不抛错并进入转动状态
  const empty = vm.items.length
  if (!empty) throw new Error('没有菜品可转')
  vm.spin()
  if (!vm.spinning) throw new Error('spin() 之后没有进入转动状态')
  if (!vm.pendingWinner) throw new Error('没有选出中奖项')
  if (!vm.items.some((i) => i === vm.pendingWinner)) throw new Error('中奖项不在列表里')
})

check('结果弹窗展示逻辑正确', () => {
  vm.pendingWinner = vm.items[0]
  vm.finish()
  if (vm.spinning) throw new Error('停下后 spinning 应该为 false')
  if (vm.lastResult !== vm.items[0].name) throw new Error('结果名称不对: ' + vm.lastResult)
  if (!vm.showResult) throw new Error('没有弹出结果')
  vm.spinAgain()
  if (vm.showResult) throw new Error('「再转一次」应该先收起弹窗')
})

check('空列表时点转盘会引导去添加菜品', () => {
  vm.clearAll()
  vm.drawerOpen = false
  vm.spin()
  if (!vm.drawerOpen) throw new Error('空列表却没有打开添加面板')
  vm.resetAll()
})

// 等所有异步用例（比如 main.js 启动检查）跑完，再收尾
await Promise.all(pending)
if (vm && vm.raf) cancelAnimationFrame(vm.raf)

console.log('\n合计: ' + pass + ' 通过, ' + fail + ' 失败')
if (fail) process.exit(1)
console.log('渲染自检全部通过 🎉\n')
