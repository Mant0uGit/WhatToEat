/** 中奖弹窗 */
export default {
  name: 'ResultOverlay',
  props: {
    visible: { type: Boolean, default: false },
    name: { type: String, default: '' },
    hint: { type: String, default: '' }
  },
  emits: ['close', 'again'],
  template: /* html */ `
  <transition name="pop">
    <div v-if="visible" class="result-mask" @click.self="$emit('close')">
      <div class="result-card" role="dialog" aria-live="polite">
        <p class="result-eyebrow">今天的答案是</p>
        <p class="result-name">{{ name }}</p>
        <p class="result-hint">{{ hint }}</p>
        <div class="result-actions">
          <button type="button" class="btn btn-ghost" @click="$emit('close')">好哒</button>
          <button type="button" class="btn btn-primary" @click="$emit('again')">再转一次</button>
        </div>
      </div>
    </div>
  </transition>`,
  style: /* css */ `
  .result-mask {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(60, 34, 20, 0.42);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }
  .result-card {
    width: min(88vw, 340px);
    padding: 26px 22px 20px;
    border-radius: 24px;
    text-align: center;
    background: linear-gradient(180deg, #fffaf4, #fff1e2);
    box-shadow: 0 18px 44px rgba(120, 66, 30, 0.3), inset 0 0 0 3px #ffd9ab;
  }
  .result-eyebrow { margin: 0 0 6px; font-size: 0.86rem; letter-spacing: 3px; color: #c08a5c; }
  .result-name {
    margin: 0 0 10px;
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.25;
    word-break: break-word;
    color: #f0662b;
    text-shadow: 0 2px 0 #ffe0c2;
  }
  .result-hint { margin: 0 0 18px; font-size: 0.85rem; color: #a98872; min-height: 1.2em; }
  .result-actions { display: flex; gap: 10px; }
  .btn {
    flex: 1;
    padding: 12px 8px;
    border-radius: 14px;
    border: none;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    transition: transform 0.12s ease, filter 0.12s ease;
  }
  .btn:active { transform: scale(0.97); }
  .btn-ghost { background: #ffe8d2; color: #b57b4e; }
  .btn-primary {
    background: linear-gradient(160deg, #ff9a4d, #ff6b3d);
    color: #fff;
    box-shadow: 0 8px 18px rgba(255, 107, 61, 0.4);
  }
  .pop-enter-active, .pop-leave-active { transition: opacity 0.2s ease; }
  .pop-enter-active .result-card, .pop-leave-active .result-card {
    transition: transform 0.24s cubic-bezier(0.22, 1.2, 0.4, 1);
  }
  .pop-enter-from, .pop-leave-to { opacity: 0; }
  .pop-enter-from .result-card, .pop-leave-to .result-card { transform: scale(0.84) translateY(10px); }`
}
