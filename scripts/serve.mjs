/**
 * 零依赖的本地静态服务器（Node 自带模块，不需要 npm install）。
 * 用法：npm start  或者  node scripts/serve.mjs
 *  - 本机打开 http://localhost:5173/
 *  - 会打印局域网地址，手机连同一个 WiFi 就能直接试玩（微信里也能打开）
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.PORT || 5173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

// 只服务网页需要的目录，避免把 .git / 测试脚本也暴露出去
const ALLOWED_PREFIX = ['index.html', 'src', 'vendor', 'assets', 'public']

function isAllowed(relPath) {
  const first = relPath.split(/[\\/]/)[0]
  return ALLOWED_PREFIX.includes(first)
}

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('[serve] 没找到 index.html，请确认在项目根目录下运行。')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  let urlPath
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  } catch {
    urlPath = '/'
  }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html'

  const rel = urlPath.replace(/^\/+/, '')
  const filePath = path.resolve(ROOT, rel)

  // 防目录穿越
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('403 forbidden')
    return
  }
  if (!isAllowed(rel)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('403 forbidden (只提供页面相关文件)')
    return
  }

  let target = filePath
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(ROOT, 'index.html') // 单页应用回退
  }

  const ext = path.extname(target).toLowerCase()
  const body = fs.readFileSync(target)
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60'
  })
  res.end(body)
})

server.listen(PORT, '0.0.0.0', () => {
  const lan = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) lan.push(net.address)
    }
  }
  console.log('')
  console.log('  🍚 今天吃什么 —— 本地预览已启动')
  console.log('  本机：   http://localhost:' + PORT + '/')
  for (const ip of lan) {
    console.log('  手机：   http://' + ip + ':' + PORT + '/   （需和电脑连同一个 WiFi）')
  }
  console.log('  Ctrl + C 退出')
  console.log('')
})
