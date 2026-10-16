import { PALETTE, shortLabel } from '../utils/constants.js'
import { TAU, segmentMidAngle } from '../utils/wheelMath.js'
import PointerMark from './PointerMark.js'

// 逻辑坐标系里给指针留的高度（CSS 像素）
const POINTER_H = 28
const LOGICAL_MAX = 560

/** 转盘本体：canvas 画静态扇区，旋转交给 CSS，转动时不用每帧重绘 */
export default {
  name: 'WheelCanvas',
  components: { PointerMark },
  props: {
    segments: { type: Array, default: () => [] },
    rotation: { type: Number, default: 0 },
    spinning: { type: Boolean, default: false },
    pointerSide: { type: String, default: 'top' }
  },
  emits: ['spin'],
  data() {
    return { size: 300, ro: null }
  },
  computed: {
    ariaLabel() {
      if (!this.segments.length) return '空转盘，请先添加选项'
      return '转盘，共 ' + this.segments.length + ' 个选项：' + this.segments.map((s) => s.name).join('、')
    },
    pad() {
      return this.pointerSide === 'top' ? POINTER_H : 0
    },
    wheelSize() {
      return Math.max(1, this.size - POINTER_H)
    },
    canvasStyle() {
      return {
        width: this.size + 'px',
        height: this.size + 'px',
        transform: 'rotate(' + this.rotation + 'rad)'
      }
    },
    holderStyle() {
      return { width: this.size + 'px', height: this.size + 'px', paddingTop: this.pad + 'px' }
    },
    nameKey() {
      return this.segments.map((s) => s.name).join('|')
    }
  },
  watch: {
    nameKey() {
      this.$nextTick(this.draw)
    },
    size() {
      this.$nextTick(this.draw)
    },
    pad() {
      this.$nextTick(this.draw)
    }
  },
  mounted() {
    this.measure()
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure())
      if (this.$refs.stage) this.ro.observe(this.$refs.stage)
    }
    window.addEventListener('resize', this.measure)
    window.addEventListener('orientationchange', this.measure)
  },
  beforeUnmount() {
    if (this.ro) this.ro.disconnect()
    window.removeEventListener('resize', this.measure)
    window.removeEventListener('orientationchange', this.measure)
  },
  methods: {
    measure() {
      const host = this.$refs.stage
      const avail = host && Number.isFinite(host.clientWidth) && host.clientWidth > 0 ? host.clientWidth : LOGICAL_MAX
      const next = Math.max(240, Math.min(LOGICAL_MAX, Math.floor(avail - 8)))
      if (Number.isFinite(next) && next !== this.size) this.size = next
      this.draw()
    },
    draw() {
      const canvas = this.$refs.canvas
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const cssSize = this.size
      canvas.width = Math.round(cssSize * dpr)
      canvas.height = Math.round(cssSize * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssSize, cssSize)

      const cx = cssSize / 2
      const cy = this.pad + this.wheelSize / 2
      const radius = this.wheelSize / 2

      // 底盘
      ctx.beginPath()
      ctx.arc(cx, cy, radius - 1, 0, TAU)
      ctx.fillStyle = '#fff6ec'
      ctx.fill()

      const list = this.segments
      if (!list.length) {
        ctx.setLineDash([7, 8])
        ctx.lineWidth = 3
        ctx.strokeStyle = '#e6cfba'
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(20, radius - 8), 0, TAU)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#b39479'
        ctx.font = '500 16px system-ui, -apple-system, "PingFang SC", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('还没有菜品', cx, cy - 11)
        ctx.fillText('去下面添加吧 ↓', cx, cy + 13)
        return
      }

      const n = list.length
      const inner = radius * 0.92
      const seg = TAU / n

      list.forEach((item, i) => {
        const start = i * seg
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, inner, start, start + seg)
        ctx.closePath()
        ctx.fillStyle = PALETTE[i % PALETTE.length]
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.stroke()
      })

      // 扇区文字
      const base = Math.max(9.5, Math.min(17, (inner * 1.55 * Math.PI) / n / 1.7))
      ctx.font =
        '600 ' + base + 'px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      const maxChars = Math.max(3, Math.floor((inner * 0.66) / base))

      list.forEach((item, i) => {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(segmentMidAngle(i, n))
        ctx.fillStyle = '#ffffff'
        ctx.shadowColor = 'rgba(0,0,0,0.22)'
        ctx.shadowBlur = 2
        ctx.shadowOffsetY = 1
        ctx.fillText(shortLabel(item.name, maxChars), inner - 12, 0)
        ctx.restore()
      })

      // 内圈白边 + 外圈金边
      ctx.beginPath()
      ctx.arc(cx, cy, inner, 0, TAU)
      ctx.lineWidth = 6
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, radius - 3, 0, TAU)
      ctx.lineWidth = 6
      ctx.strokeStyle = '#ffb347'
      ctx.stroke()

      // 中心留给「开始」按钮
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 0.27, 0, TAU)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255,179,71,0.55)'
      ctx.stroke()
    }
  },
  template: /* html */ `
  <div class="wheel-stage" :class="{ 'wheel-stage--spinning': spinning, 'wheel-stage--empty': !segments.length }">
    <div class="wheel-bloom" aria-hidden="true"></div>

    <div ref="stage" class="wheel-host">
      <div class="wheel-holder" :style="holderStyle">
        <PointerMark :side="pointerSide" :hot="spinning" />
        <canvas ref="canvas" class="wheel-canvas" :style="canvasStyle" role="img" :aria-label="ariaLabel"></canvas>
      </div>
      <div class="wheel-hub">
        <button
          type="button"
          class="hub-btn"
          :disabled="spinning || !segments.length"
          :aria-label="spinning ? '正在转动' : '开始转动转盘'"
          @click="$emit('spin')"
        >
          <span v-if="spinning" class="hub-text--small">转动中</span>
          <span v-else-if="!segments.length" class="hub-text--small">先加菜</span>
          <span v-else>开始</span>
        </button>
      </div>
    </div>
  </div>`,
  style: /* css */ `
  .wheel-stage {
    position: relative;
    width: 100%;
    padding: 6px 0 2px;
    display: flex;
    justify-content: center;
    transition: transform 0.25s ease;
  }
  .wheel-stage--spinning { transform: scale(1.02); }
  .wheel-bloom {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(94vw, 540px);
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 45%, rgba(255, 176, 71, 0.4), rgba(255, 176, 71, 0) 68%);
    filter: blur(6px);
    animation: bloom 3.2s ease-in-out infinite alternate;
    pointer-events: none;
  }
  @keyframes bloom {
    from { opacity: 0.6; transform: translate(-50%, -50%) scale(0.96); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1.03); }
  }
  .wheel-host {
    position: relative;
    display: flex;
    justify-content: center;
  }
  .wheel-holder {
    position: relative;
    box-sizing: content-box;
    border-radius: 50%;
  }
  .wheel-canvas {
    display: block;
    will-change: transform;
    backface-visibility: hidden;
  }
  .wheel-hub {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .hub-btn {
    pointer-events: auto;
    width: 26%;
    min-width: 78px;
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-family: inherit;
    color: #fff;
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: 1px;
    background: linear-gradient(160deg, #ff9a4d, #ff6b3d 70%);
    box-shadow: 0 8px 18px rgba(255, 107, 61, 0.45), inset 0 -3px 0 rgba(0, 0, 0, 0.12);
    transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .hub-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 10px 22px rgba(255, 107, 61, 0.55), inset 0 -3px 0 rgba(0, 0, 0, 0.12);
  }
  .hub-btn:active:not(:disabled) { transform: scale(0.96); }
  .hub-btn:disabled {
    cursor: default;
    filter: grayscale(0.25) brightness(1.04);
    box-shadow: 0 6px 14px rgba(180, 120, 90, 0.3);
  }
  .hub-text--small { font-size: 0.78rem; letter-spacing: 0; }
  .wheel-stage--empty .hub-btn { background: linear-gradient(160deg, #d9b79a, #bf9d80); }
  @media (max-width: 380px) {
    .hub-btn { font-size: 1rem; min-width: 70px; }
  }`
}
