// 构建后生成 dist/_headers（Cloudflare 读取）：安全响应头 + 缓存策略。
// CSP 里的内联脚本哈希从构建好的页面里现算，脚本改了哈希自动跟着变，不会因为手写过期而把网站弄坏。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DIST = 'dist';
async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (p.endsWith('.html')) yield p;
  }
}

const hashes = new Set();
for await (const f of walk(DIST)) {
  const html = await readFile(f, 'utf8');
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1] || '';
    if (/\ssrc=/.test(attrs) || /application\/json/.test(attrs)) continue; // 外部脚本由 'self' 放行；JSON 数据不执行
    hashes.add(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  }
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(' ')}`,
  "style-src 'self' 'unsafe-inline'", // 元素上的 style="--i:…" 变量和组件样式都需要
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const security = [
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  `Content-Security-Policy: ${csp}`,
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Resource-Policy: same-site',
];

const rules = [
  // 所有页面：安全头。HTML 本身不缓存（max-age=0，每次向服务器确认），发布后立刻生效
  ['/*', security],
  // 文件名带内容哈希：内容一变文件名就变，可以永久缓存
  ['/_astro/*', ['Cache-Control: public, max-age=31536000, immutable']],
  // 字体很少变，缓存 30 天
  ['/fonts/*', ['Cache-Control: public, max-age=2592000']],
  // 分享图、图标会换但名字不变，缓存 1 天
  ['/og.jpg', ['Cache-Control: public, max-age=86400']],
  ['/favicon-32.png', ['Cache-Control: public, max-age=86400']],
  ['/favicon-192.png', ['Cache-Control: public, max-age=86400']],
  ['/apple-touch-icon.png', ['Cache-Control: public, max-age=86400']],
];

const body = `# 由 scripts/build-headers.mjs 在构建后生成，不要手改。\n\n${rules.map(([path, lines]) => `${path}\n${lines.map((l) => `  ${l}`).join('\n')}`).join('\n\n')}\n`;
await writeFile(join(DIST, '_headers'), body);
console.log(`_headers：${hashes.size} 个内联脚本哈希写入 CSP。`);
