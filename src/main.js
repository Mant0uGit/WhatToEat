/**
 * 入口：零构建方案。
 * 页面里先用 <script src="vendor/vue.global.prod.js"> 引入 Vue 3（就是官方生产版本），
 * 这里只做三件事：注入样式、注册组件、挂载应用。
 */
import App from './App.js'
import WheelCanvas from './components/WheelCanvas.js'
import ListItemPanel from './components/ListItemPanel.js'
import ResultOverlay from './components/ResultOverlay.js'
import ConfettiFx from './components/ConfettiFx.js'
import PointerMark from './components/PointerMark.js'

// 每个组件把自己的 CSS 写成 style 字符串，这里统一塞进 <head>。
// 类名都是各组件独有的，不会互相打架；好处是不需要任何打包工具。
const COMPONENT_STYLES = [App, WheelCanvas, ListItemPanel, ResultOverlay, ConfettiFx, PointerMark]
  .map((c) => c.style)
  .filter(Boolean)
  .join('\n')

const GLOBAL_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
html, body { margin: 0; padding: 0; min-height: 100%; }
body {
  font-family: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    'Helvetica Neue', Arial, sans-serif;
  color: #5c3a1e;
  background: #fdeede;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
  overscroll-behavior-y: none;
}
input, button, textarea, select { font-family: inherit; }
input { user-select: text; -webkit-user-select: text; }
#app { min-height: 100vh; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
`

function injectStyle(css, id) {
  const el = document.createElement('style')
  el.id = id
  el.textContent = css
  document.head.appendChild(el)
}

function showFatal(message) {
  const root = document.getElementById('app')
  if (root) {
    root.innerHTML =
      '<div style="padding:28px;font:16px/1.7 system-ui,sans-serif;color:#7a4a24;text-align:center">' +
      '<p style="font-size:1.4rem">😵 页面没能启动</p>' +
      '<p>' + message + '</p>' +
      '<p style="font-size:.85rem;color:#b99477">请用微信/浏览器重新打开一次；如果还不行，把这句话截图发给他。</p>' +
      '</div>'
  }
}

function boot() {
  const Vue = window.Vue
  if (!Vue || typeof Vue.createApp !== 'function') {
    showFatal('Vue 没有加载成功（vendor/vue.global.prod.js）。')
    return
  }

  injectStyle(GLOBAL_CSS, 'wte-global-css')
  injectStyle(COMPONENT_STYLES, 'wte-component-css')

  const app = Vue.createApp(App)
  app.component('WheelCanvas', WheelCanvas)
  app.component('ListItemPanel', ListItemPanel)
  app.component('ResultOverlay', ResultOverlay)
  app.component('ConfettiFx', ConfettiFx)
  app.component('PointerMark', PointerMark)

  app.config.errorHandler = (err, instance, info) => {
    // 出错也不要白屏，把信息留在控制台方便排查
    console.error('[what-to-eat] 渲染出错:', info, err)
  }

  try {
    app.mount('#app')
  } catch (err) {
    console.error(err)
    showFatal('初始化时出错了：' + (err && err.message ? err.message : String(err)))
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
