import { PALETTE } from '../utils/constants.js'

/** 中奖时撒的彩带：canvas 手写粒子，不需要任何第三方库 */
export default {
  name: 'ConfettiFx',
  data() {
    return { particles: [], running: false, raf: 0, dpr: 1 }
  },
  mounted() {
    this.resize()
    window.addEventListener('resize', this.resize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.resize)
    if (this.raf) cancelAnimationFrame(this.raf)
  },
  methods: {
    ctx() {
      return this.$refs.canvas ? this.$refs.canvas.getContext('2d') : null
    },
    resize() {
      const canvas = this.$refs.canvas
      if (!canvas) return
      this.dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * this.dpr)
      canvas.height = Math.round(window.innerHeight * this.dpr)
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      const ctx = this.ctx()
      if (ctx) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    },
    fire(count) {
      const n = Number(count) || 110
      const ctx = this.ctx()
      if (!ctx) return
      const w = window.innerWidth
      for (let i = 0; i < n; i += 1) {
        const fromLeft = i % 2 === 0
        this.particles.push({
          x: fromLeft ? w * (0.08 + Math.random() * 0.24) : w * (0.68 + Math.random() * 0.24),
          y: window.innerHeight * (0.1 + Math.random() * 0.22),
          vx: (fromLeft ? 1 : -1) * (1.2 + Math.random() * 3.6),
          vy: -3 - Math.random() * 4.6,
          size: 5 + Math.random() * 7,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.32,
          color: PALETTE[i % PALETTE.length],
          life: 1,
          decay: 0.006 + Math.random() * 0.006,
          shape: Math.random() < 0.35 ? 'circle' : 'rect'
        })
      }
      if (!this.running) {
        this.running = true
        this.loop()
      }
    },
    loop() {
      this.raf = requestAnimationFrame(this.loop)
      const ctx = this.ctx()
      if (!ctx) return
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      this.particles = this.particles.filter((p) => p.life > 0 && p.y < h + 40)
      if (!this.particles.length) {
        this.running = false
        cancelAnimationFrame(this.raf)
        this.raf = 0
        return
      }

      for (const p of this.particles) {
        p.vy += 0.16
        p.vx *= 0.995
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life -= p.decay

        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        }
        ctx.restore()
      }
    }
  },
  template: /* html */ `<canvas ref="canvas" class="confetti" aria-hidden="true"></canvas>`,
  style: /* css */ `
  .confetti {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60;
  }`
}
