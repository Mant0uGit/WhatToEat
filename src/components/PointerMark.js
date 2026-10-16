/** 指针：一直指着转盘，转盘停在哪一格，结果就是谁 */
export default {
  name: 'PointerMark',
  props: {
    side: { type: String, default: 'top' },
    hot: { type: Boolean, default: false }
  },
  data() {
    return { gid: 'ptr-' + Math.random().toString(36).slice(2, 8) }
  },
  template: /* html */ `
  <div class="pointer" :class="['pointer--' + side, { 'pointer--hot': hot }]" aria-hidden="true">
    <svg viewBox="0 0 44 60" width="100%" height="100%">
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#ffe2c2" />
        </linearGradient>
      </defs>
      <path
        :d="side === 'top' ? 'M22 58 L4 20 A20 20 0 0 1 40 20 Z' : 'M22 2 L4 40 A20 20 0 0 0 40 40 Z'"
        :fill="'url(#' + gid + ')'"
        stroke="#ff7a59"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <circle :cy="side === 'top' ? 16 : 44" cx="22" r="5" fill="#ff7a59" />
    </svg>
  </div>`,
  style: /* css */ `
  .pointer {
    position: absolute;
    left: 50%;
    width: 30px;
    height: 42px;
    transform: translateX(-50%);
    filter: drop-shadow(0 4px 6px rgba(214, 108, 60, 0.35));
    transition: transform 0.16s ease;
    z-index: 4;
    pointer-events: none;
  }
  .pointer--top { top: 0; }
  .pointer--bottom { bottom: 0; transform: translateX(-50%) rotate(180deg); }
  .pointer--hot { animation: pointerHot 0.6s ease-in-out infinite alternate; }
  @keyframes pointerHot {
    from { filter: drop-shadow(0 4px 6px rgba(214, 108, 60, 0.35)); }
    to { filter: drop-shadow(0 4px 16px rgba(255, 122, 89, 0.95)); }
  }`
}
