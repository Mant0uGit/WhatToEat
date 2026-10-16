import WheelCanvas from './components/WheelCanvas.js'
import ListItemPanel from './components/ListItemPanel.js'
import ResultOverlay from './components/ResultOverlay.js'
import ConfettiFx from './components/ConfettiFx.js'

import { haptic, fanfare, tick, makeId, clamp } from './utils/constants.js'
import { loadState, saveState, defaultItems } from './utils/storage.js'
import { buildSpin, pickWinner, shuffledIndices, TAU } from './utils/wheelMath.js'

/** 比 easeOutQuint 更利落的收尾，转盘停下时更自然 */
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4)
}

export default {
  name: 'App',
  components: { WheelCanvas, ListItemPanel, ResultOverlay, ConfettiFx },
  data() {
    const saved = loadState()
    return {
      items: saved.items,
      mode: saved.mode,
      sound: saved.sound,

      // 转盘上的排列顺序（每次转动都会重新洗牌）
      order: saved.items.map((_, i) => i),

      rotation: 0,
      spinning: false,
      lastResult: '',
      showResult: false,
      drawerOpen: false,

      // 内部计时用，不参与渲染
      raf: 0,
      lastIndex: -1,
      startAt: 0,
      spinDuration: 5000,
      pendingWinner: null,
      saveTimer: 0
    }
  },
  computed: {
    segments() {
      return this.order.map((i) => this.items[i]).filter(Boolean)
    },
    subtitle() {
      if (!this.items.length) return '还没有菜品，先添加几个吧'
      return this.spinning ? '老天爷正在挑选…' : '选择困难症の救星'
    },
    resultHint() {
      if (!this.lastResult) return ''
      const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      return '共 ' + this.items.length + ' 个选项里选出的结果 · ' + time
    }
  },
  watch: {
    items: {
      deep: true,
      handler() {
        this.order = shuffledIndices(this.items.length)
        this.persist()
      }
    },
    mode() {
      this.persist()
    },
    sound() {
      this.persist()
    }
  },
  mounted() {
    this.order = shuffledIndices(this.items.length)
    document.addEventListener('gesturestart', this.blockGesture, { passive: false })
  },
  beforeUnmount() {
    if (this.raf) cancelAnimationFrame(this.raf)
    document.removeEventListener('gesturestart', this.blockGesture)
    clearTimeout(this.saveTimer)
  },
  methods: {
    blockGesture(e) {
      e.preventDefault()
    },

    /* ---------- 本地存储 ---------- */
    persist() {
      clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => {
        saveState({ items: this.items, mode: this.mode, sound: this.sound })
      }, 120)
    },

    /* ---------- 列表操作 ---------- */
    findIndexById(id) {
      return this.items.findIndex((i) => i.id === id)
    },
    addItem(name) {
      const clean = String(name || '').trim().slice(0, 20)
      if (!clean) return
      if (this.items.some((i) => i.name === clean)) return
      if (this.items.length >= 40) return
      this.items.push({ id: makeId(), name: clean, weight: 1 })
    },
    renameItem(payload) {
      const clean = String(payload.name || '').trim().slice(0, 20)
      if (!clean) return
      if (this.items.some((i) => i.name === clean && i.id !== payload.id)) return
      const i = this.findIndexById(payload.id)
      if (i >= 0) this.items[i].name = clean
    },
    setWeight(payload) {
      const i = this.findIndexById(payload.id)
      if (i >= 0) this.items[i].weight = clamp(Number(payload.weight) || 0, 0, 9)
    },
    removeItem(id) {
      const i = this.findIndexById(id)
      if (i >= 0) this.items.splice(i, 1)
      haptic(12)
    },
    clearAll() {
      this.items = []
    },
    resetAll() {
      this.items = defaultItems()
    },
    shuffleOrder() {
      this.order = shuffledIndices(this.items.length)
      haptic(14)
    },
    toggleMode(e) {
      this.mode = e.target.checked ? 'uniform' : 'weighted'
    },
    toggleSound(e) {
      this.sound = e.target.checked
    },

    /* ---------- 转动 ---------- */
    /** 正上方指针当前指着的扇区下标（用来做「咔哒」声） */
    currentIndexAtTop(rot) {
      const n = this.segments.length
      if (!n) return -1
      const seg = TAU / n
      const norm = ((rot % TAU) + TAU) % TAU
      return Math.floor(((((-Math.PI / 2 - norm) % TAU) + TAU) % TAU) / seg) % n
    },

    spin() {
      if (this.spinning) return
      if (!this.items.length) {
        this.drawerOpen = true
        return
      }

      this.showResult = false
      // 每次都重新洗牌：公平，而且看起来不像同一个轮子
      this.order = shuffledIndices(this.items.length)

      const winner = pickWinner(
        this.segments.map((s) => ({ weight: s.weight })),
        this.mode
      )
      if (!winner) return

      this.pendingWinner = this.segments[winner.index]
      this.spinDuration = Math.round(4600 + Math.random() * 1100)

      const { targetRotation } = buildSpin(winner.index, this.segments.length, this.rotation, {
        turns: 6,
        jitter: 0.6
      })

      const from = this.rotation
      const total = targetRotation - from
      this.spinning = true
      this.lastIndex = this.currentIndexAtTop(from)
      this.startAt = performance.now()

      const step = () => {
        const t = Math.min(1, (performance.now() - this.startAt) / this.spinDuration)
        this.rotation = from + total * easeOutQuart(t)

        const idx = this.currentIndexAtTop(this.rotation)
        if (idx !== this.lastIndex) {
          this.lastIndex = idx
          if (this.sound) {
            const speed = 1 - t
            tick(540 + Math.round(speed * 560) + (idx % 5) * 26, 0.028, 0.02 + t * 0.03)
          }
        }

        if (t < 1) {
          this.raf = requestAnimationFrame(step)
        } else {
          this.rotation = targetRotation
          this.finish()
        }
      }
      this.raf = requestAnimationFrame(step)
      haptic(20)
    },

    finish() {
      this.spinning = false
      this.lastResult = this.pendingWinner ? this.pendingWinner.name : ''
      this.showResult = true
      if (this.$refs.confetti) this.$refs.confetti.fire(120)
      if (this.sound) fanfare()
      haptic([26, 60, 26])
    },

    spinAgain() {
      this.showResult = false
      setTimeout(() => this.spin(), 180)
    }
  },
  template: /* html */ `
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo" aria-hidden="true">🍚</span>
        <div class="brand-text">
          <h1>今天吃什么</h1>
          <p class="sub">{{ subtitle }}</p>
        </div>
      </div>
      <button type="button" class="icon-btn" aria-label="打开菜品列表" @click="drawerOpen = true">☰</button>
    </header>

    <main class="main">
      <WheelCanvas
        ref="canvasWheel"
        :segments="segments"
        :rotation="rotation"
        :spinning="spinning"
        pointer-side="top"
        @spin="spin"
      />

      <div class="under">
        <transition name="rise" mode="out-in">
          <div v-if="spinning" key="spin" class="status status--spin">
            <span class="dots"><i></i><i></i><i></i></span> 转盘正在转…
          </div>
          <div v-else-if="lastResult" key="res" class="status status--done">
            刚刚转到：<strong>{{ lastResult }}</strong>
          </div>
          <div v-else key="idle" class="status">点转盘中间的「开始」，让天意决定～</div>
        </transition>

        <div class="actions">
          <button type="button" class="btn btn-main" :disabled="spinning || !items.length" @click="spin">
            {{ spinning ? '转动中…' : '开始转' }}
          </button>
          <button type="button" class="btn btn-alt" @click="drawerOpen = true">管理菜品</button>
        </div>

        <div class="switches">
          <label class="switch">
            <input type="checkbox" :checked="mode === 'uniform'" @change="toggleMode" />
            <span class="track"><span class="knob"></span></span>
            <span class="switch-text">所有菜等概率</span>
          </label>
          <label class="switch">
            <input type="checkbox" :checked="sound" @change="toggleSound" />
            <span class="track"><span class="knob"></span></span>
            <span class="switch-text">音效</span>
          </label>
        </div>

        <p class="footnote">共 {{ items.length }} 个选项 · 记录只存在这台手机上</p>
      </div>
    </main>

    <ListItemPanel
      :open="drawerOpen"
      :items="items"
      @close="drawerOpen = false"
      @add="addItem"
      @rename="renameItem"
      @weight="setWeight"
      @remove="removeItem"
      @clear="clearAll"
      @reset="resetAll"
      @shuffle="shuffleOrder"
    />

    <ResultOverlay
      :visible="showResult"
      :name="lastResult"
      :hint="resultHint"
      @close="showResult = false"
      @again="spinAgain"
    />

    <ConfettiFx ref="confetti" />
  </div>`,
  style: /* css */ `
  .app {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at 15% 0%, rgba(255, 214, 165, 0.55), transparent 46%),
      radial-gradient(circle at 88% 12%, rgba(255, 180, 180, 0.4), transparent 42%),
      linear-gradient(180deg, #fff7ef 0%, #fdeede 62%, #fbe6d3 100%);
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) 18px 6px;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .logo { font-size: 1.9rem; line-height: 1; filter: drop-shadow(0 3px 4px rgba(200, 120, 60, 0.3)); }
  .brand-text { min-width: 0; }
  .brand-text h1 { margin: 0; font-size: 1.32rem; letter-spacing: 1px; color: #6b3f1d; }
  .sub { margin: 2px 0 0; font-size: 0.78rem; color: #b07f56; }
  .icon-btn {
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    border-radius: 13px;
    border: none;
    background: #fff;
    color: #b5763f;
    font-size: 1.1rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(190, 130, 80, 0.22);
    touch-action: manipulation;
  }
  .icon-btn:active { transform: scale(0.95); }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 14px calc(env(safe-area-inset-bottom, 0px) + 22px);
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
  }
  .under {
    width: 100%;
    max-width: 460px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
  }
  .status {
    min-height: 2.4em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    font-size: 0.92rem;
    color: #9c7355;
    padding: 4px 12px;
  }
  .status--done strong { color: #f0662b; font-size: 1.16rem; margin-left: 4px; }
  .status--spin { color: #d1691f; }
  .dots { display: inline-flex; gap: 4px; }
  .dots i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff9a4d;
    animation: bounce 1s infinite ease-in-out;
  }
  .dots i:nth-child(2) { animation-delay: 0.15s; }
  .dots i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.55; }
    40% { transform: translateY(-5px); opacity: 1; }
  }
  .actions { display: flex; gap: 10px; width: 100%; }
  .btn {
    border: none;
    border-radius: 15px;
    font-family: inherit;
    font-size: 1.02rem;
    font-weight: 700;
    cursor: pointer;
    padding: 14px 10px;
    touch-action: manipulation;
    transition: transform 0.12s ease, filter 0.12s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active:not(:disabled) { transform: scale(0.975); }
  .btn:disabled { cursor: default; filter: grayscale(0.4); opacity: 0.7; }
  .btn-main {
    flex: 1.5;
    color: #fff;
    background: linear-gradient(160deg, #ff9a4d, #ff6b3d);
    box-shadow: 0 10px 22px rgba(255, 107, 61, 0.38);
  }
  .btn-alt { flex: 1; color: #b5763f; background: #fff; box-shadow: 0 6px 16px rgba(190, 130, 80, 0.18); }
  .switches { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: center; }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }
  .switch input { position: absolute; opacity: 0; pointer-events: none; }
  .track {
    width: 40px;
    height: 23px;
    border-radius: 999px;
    background: #f0dcc8;
    position: relative;
    transition: background 0.18s ease;
    flex: 0 0 auto;
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(150, 100, 60, 0.35);
    transition: transform 0.18s cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  .switch input:checked + .track { background: linear-gradient(160deg, #ffb347, #ff8a4d); }
  .switch input:checked + .track .knob { transform: translateX(17px); }
  .switch input:focus-visible + .track { box-shadow: 0 0 0 3px rgba(255, 154, 77, 0.4); }
  .switch-text { font-size: 0.83rem; color: #a3765a; }
  .footnote { margin: 0; font-size: 0.73rem; color: #bd9a80; text-align: center; }
  .rise-enter-active, .rise-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
  .rise-enter-from, .rise-leave-to { opacity: 0; transform: translateY(6px); }
  @media (min-width: 620px) {
    .brand-text h1 { font-size: 1.5rem; }
    .status { font-size: 1rem; }
  }`
}
