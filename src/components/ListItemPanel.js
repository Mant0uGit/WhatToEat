import { PALETTE, clamp } from '../utils/constants.js'

const QUICK = [
  '麻辣烫', '火锅', '烤肉', '汉堡', '炸鸡', '寿司', '螺蛳粉', '酸菜鱼',
  '饺子', '盖浇饭', '米线', '冒菜', '沙拉', '麻辣香锅', '烧烤', '牛肉面',
  '披萨', '粥', '关东煮', '汉堡王'
]

/** 菜品编辑抽屉：加/删/改名/调概率 */
export default {
  name: 'ListItemPanel',
  props: {
    open: { type: Boolean, default: false },
    items: { type: Array, default: () => [] }
  },
  emits: ['close', 'add', 'rename', 'weight', 'remove', 'clear', 'reset', 'shuffle'],
  data() {
    return { draft: '', error: '' }
  },
  computed: {
    suggestions() {
      const have = new Set(this.items.map((i) => i.name))
      return QUICK.filter((q) => !have.has(q)).slice(0, 12)
    }
  },
  watch: {
    open(v) {
      if (v) this.error = ''
    }
  },
  methods: {
    colorOf(index) {
      return PALETTE[index % PALETTE.length]
    },
    doAdd(name) {
      const clean = String(name || '').trim()
      if (!clean) return false
      if (this.items.length >= 40) {
        this.error = '最多 40 个选项，再多转盘就看不清啦'
        return false
      }
      if (this.items.some((i) => i.name === clean)) {
        this.error = '「' + clean + '」已经在列表里啦'
        return false
      }
      this.error = ''
      this.$emit('add', clean)
      return true
    },
    submit() {
      if (this.doAdd(this.draft)) this.draft = ''
    },
    quickAdd(name) {
      this.doAdd(name)
    },
    onRename(item, event) {
      const next = String(event.target.value || '').trim()
      if (!next || next === item.name) {
        event.target.value = item.name
        return
      }
      this.$emit('rename', { id: item.id, name: next })
    },
    bump(item, step) {
      const next = clamp(Number(item.weight || 0) + step, 0, 9)
      if (next === item.weight) return
      this.$emit('weight', { id: item.id, weight: next })
    }
  },
  template: /* html */ `
  <div>
    <transition name="fade">
      <div v-if="open" class="drawer-mask" @click.self="$emit('close')"></div>
    </transition>

    <transition name="slide">
      <aside v-if="open" class="drawer" role="dialog" aria-label="编辑菜品列表">
        <header class="drawer-head">
          <h2>菜品列表<span class="count">{{ items.length }} 项</span></h2>
          <button type="button" class="close" aria-label="关闭" @click="$emit('close')">✕</button>
        </header>

        <div class="drawer-body">
          <form class="add-row" @submit.prevent="submit">
            <input
              v-model="draft"
              class="add-input"
              type="text"
              maxlength="20"
              enterkeyhint="done"
              placeholder="想吃啥？比如「酸菜鱼」"
              aria-label="新增菜品名称"
            />
            <button type="submit" class="add-btn" :disabled="!draft.trim()">添加</button>
          </form>
          <p v-if="error" class="error">{{ error }}</p>

          <div v-if="suggestions.length" class="quick">
            <span class="quick-label">点一下快速添加：</span>
            <div class="quick-chips">
              <button v-for="s in suggestions" :key="s" type="button" class="chip" @click="quickAdd(s)">
                ＋{{ s }}
              </button>
            </div>
          </div>

          <ul v-if="items.length" class="list">
            <li v-for="(item, index) in items" :key="item.id" class="row">
              <span class="idx" :style="{ background: colorOf(index) }">{{ index + 1 }}</span>
              <input
                class="name"
                type="text"
                maxlength="20"
                :value="item.name"
                aria-label="菜品名称"
                @change="onRename(item, $event)"
                @keyup.enter="$event.target.blur()"
              />
              <div class="weight" title="调整被抽中的概率">
                <button type="button" class="w-btn" aria-label="降低概率" @click="bump(item, -1)">−</button>
                <span class="w-val">{{ item.weight }}</span>
                <button type="button" class="w-btn" aria-label="提高概率" @click="bump(item, 1)">＋</button>
              </div>
              <button type="button" class="del" aria-label="删除" @click="$emit('remove', item.id)">✕</button>
            </li>
          </ul>
          <p v-else class="empty">列表是空的，先加两个菜吧～</p>

          <p class="tip">
            「＋/−」调的是被抽中的概率（默认都是 1，表示一样容易中）；不想要某道菜就直接删掉。
            改完自动保存在这台手机上。
          </p>
        </div>

        <footer class="drawer-foot">
          <button type="button" class="foot-btn" @click="$emit('shuffle')">打乱顺序</button>
          <button type="button" class="foot-btn" @click="$emit('clear')">清空</button>
          <button type="button" class="foot-btn foot-btn--primary" @click="$emit('reset')">恢复默认菜单</button>
        </footer>
      </aside>
    </transition>
  </div>`,
  style: /* css */ `
  .drawer-mask {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(60, 34, 20, 0.4);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
  .drawer {
    position: fixed;
    z-index: 90;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0 auto;
    width: min(100%, 560px);
    max-height: 86vh;
    display: flex;
    flex-direction: column;
    background: #fffdfa;
    border-radius: 22px 22px 0 0;
    box-shadow: 0 -14px 40px rgba(120, 66, 30, 0.26);
    overflow: hidden;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 10px;
    border-bottom: 1px solid #f6e6d6;
  }
  .drawer-head h2 {
    margin: 0;
    font-size: 1.06rem;
    color: #7a4a24;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .count { font-size: 0.78rem; font-weight: 500; color: #b99477; }
  .close {
    border: none;
    background: #f7ece1;
    color: #a9764c;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .drawer-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 14px 18px 4px;
  }
  .add-row { display: flex; gap: 8px; }
  .add-input {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 13px;
    border: 2px solid #f0ddc9;
    background: #fffaf4;
    font-size: 1rem;
    font-family: inherit;
    color: #5c3a1e;
    outline: none;
    transition: border-color 0.15s ease;
  }
  .add-input:focus { border-color: #ffb347; }
  .add-btn {
    flex: 0 0 auto;
    padding: 0 20px;
    border: none;
    border-radius: 13px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(160deg, #ff9a4d, #ff6b3d);
    cursor: pointer;
    touch-action: manipulation;
  }
  .add-btn:disabled { opacity: 0.45; cursor: default; }
  .error { margin: 8px 2px 0; font-size: 0.82rem; color: #e05252; }
  .quick { margin-top: 12px; }
  .quick-label { font-size: 0.79rem; color: #b99477; }
  .quick-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .chip {
    padding: 6px 11px;
    border-radius: 999px;
    border: 1px solid #f3ddc6;
    background: #fff6ec;
    color: #a9764c;
    font-family: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    touch-action: manipulation;
  }
  .chip:active { background: #ffe9d4; }
  .list { list-style: none; margin: 14px 0 0; padding: 0; }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px dashed #f4e6d7;
  }
  .idx {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    color: #fff;
    font-size: 0.76rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .name {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: #fdf6ee;
    font-size: 0.98rem;
    font-family: inherit;
    color: #5c3a1e;
    outline: none;
  }
  .name:focus { border-color: #ffcf8f; background: #fffdf9; }
  .weight {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 2px;
    background: #fdf6ee;
    border-radius: 10px;
    padding: 2px;
  }
  .w-btn {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 8px;
    background: #fff;
    color: #b57b4e;
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(180, 130, 90, 0.2);
  }
  .w-btn:active { background: #ffe9d4; }
  .w-val { min-width: 18px; text-align: center; font-size: 0.85rem; font-weight: 700; color: #8a5a30; }
  .del {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 9px;
    background: #ffeaea;
    color: #e05252;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .del:active { background: #ffd6d6; }
  .empty { margin: 18px 0; text-align: center; color: #b99477; font-size: 0.9rem; }
  .tip { margin: 14px 0 8px; font-size: 0.78rem; line-height: 1.5; color: #b99477; }
  .drawer-foot {
    display: flex;
    gap: 8px;
    padding: 12px 18px 16px;
    border-top: 1px solid #f6e6d6;
    background: #fffaf4;
  }
  .foot-btn {
    flex: 1;
    padding: 11px 6px;
    border-radius: 12px;
    border: 1px solid #f0ddc9;
    background: #fff;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    color: #a9764c;
    cursor: pointer;
    touch-action: manipulation;
  }
  .foot-btn--primary { background: #fff0e0; border-color: #ffd9ab; color: #d1691f; }
  .slide-enter-active, .slide-leave-active { transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
  .slide-enter-from, .slide-leave-to { transform: translateY(102%); }
  .fade-enter-active, .fade-leave-active { transition: opacity 0.24s ease; }
  .fade-enter-from, .fade-leave-to { opacity: 0; }`
}
