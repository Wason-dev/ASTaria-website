// README 截图：用本机 Chrome（无界面）打开构建好的 dist/，滚到指定位置、等动画播完再截图，写到 docs/images/。
// 用法：npm run build && node scripts/capture-readme.mjs
// 只用 Node 自带的 WebSocket 驱动 Chrome 调试协议，图片用项目已有的 sharp 压缩，不新增依赖。
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import sharp from 'sharp';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4398, DEBUG = 9333, OUT = 'docs/images';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 截哪里：路径、视口、滚动到哪个元素（居中或贴顶）、额外操作、等待时间
const SHOTS = [
  { file: 'hero.jpg', path: '/', w: 1440, h: 900, wait: 4500 },
  { file: 'chat.jpg', path: '/', w: 1440, h: 900, target: '.chat', align: 'center', wait: 6500 },
  { file: 'features.jpg', path: '/', w: 1440, h: 900, target: '.feat', align: 'center', wait: 3800 },
  { file: 'xixi.jpg', path: '/', w: 1440, h: 1000, target: '.more-sec', align: 'top', click: '[data-tone] [data-i="2"]', wait: 2500 },
  { file: 'download.jpg', path: '/download/', w: 1440, h: 900, target: '#macos', align: 'top', offset: 120, wait: 3000 },
  { file: 'mobile.jpg', path: '/', w: 390, h: 844, scale: 3, mobile: true, wait: 4500 },
  { file: 'mobile-chat.jpg', path: '/', w: 390, h: 844, scale: 3, mobile: true, target: '.chat-demo', align: 'center', wait: 6500 },
  { file: 'mobile-features.jpg', path: '/', w: 390, h: 844, scale: 3, mobile: true, target: '.feat-stage', align: 'center', wait: 3800 },
  { file: 'mobile-download.jpg', path: '/download/', w: 390, h: 844, scale: 3, mobile: true, target: '#macos', align: 'top', offset: 90, wait: 3000 },
];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'dist'], { stdio: 'ignore' });
const profile = `/tmp/astaria-capture-${process.pid}`;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

try {
  // 等 Chrome 的调试端口就绪
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    await sleep(200);
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  }
  if (!wsUrl) throw new Error('Chrome 调试端口没有就绪');
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let seq = 0;
  const pending = new Map(), waiters = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) waiters.filter((w) => w.method === d.method).forEach((w) => { w.resolve(d); waiters.splice(waiters.indexOf(w), 1); });
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (d) => (d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolve(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
  const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

  await send('Page.enable');
  await mkdir(OUT, { recursive: true });
  for (const s of SHOTS) {
    const scale = s.scale ?? 2;
    await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: scale, mobile: !!s.mobile });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: `http://localhost:${PORT}${s.path}` });
    await loaded;
    await sleep(1500); // 黑洞开场亮起
    if (s.target) {
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(s.target)});
        const top = el.getBoundingClientRect().top + scrollY;
        const y = ${JSON.stringify(s.align)} === 'center' ? top - (innerHeight - el.offsetHeight) / 2 : top - ${s.offset ?? 40};
        scrollTo(0, Math.max(0, y));
      })()`);
      await sleep(600);
    }
    if (s.click) await evaluate(`document.querySelector(${JSON.stringify(s.click)})?.click()`);
    await sleep(s.wait);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const width = s.mobile ? 780 : 1600; // 手机图按 2 倍、桌面图按 1600 宽输出，GitHub 上看得清、文件不至于太大
    await sharp(Buffer.from(data, 'base64')).resize({ width }).jpeg({ quality: 84, mozjpeg: true }).toFile(`${OUT}/${s.file}`);
    console.log(`  ${OUT}/${s.file}`);
  }
  ws.close();
} finally {
  chrome.kill();
  server.kill();
  await sleep(300);
  await rm(profile, { recursive: true, force: true });
}
