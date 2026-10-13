// 链接检查：扫描 dist/ 中所有 href 与 src。站内链接必须对应构建产物中的文件或锚点；
// 站外链接发 HEAD 请求（GitHub 下载链接跟随重定向，不下载文件本体）。用法：npm run build && npm run verify:links
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = 'dist';
const pages = new Map();
async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
const files = new Set();
for await (const f of walk(DIST)) {
  files.add('/' + f.slice(DIST.length + 1));
  if (extname(f) === '.html') pages.set('/' + f.slice(DIST.length + 1), await readFile(f, 'utf8'));
}
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const resolvePage = (path) => {
  const p = path.endsWith('/') ? path + 'index.html' : path;
  if (pages.has(p)) return p;
  if (pages.has(p + '/index.html')) return p + '/index.html';
  return null;
};

const internal = [], external = new Set();
for (const [page, html] of pages) {
  for (const m of html.matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)) {
    for (const raw of m[1].split(',').map((s) => s.trim().split(/\s+/)[0])) {
      if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:')) continue;
      if (/^https?:\/\//.test(raw)) {
        // 指向本站自己的绝对地址（canonical、Open Graph、sitemap）不发请求：上线前域名还不能访问
        if (!/^https?:\/\/(www\.)?astaria\.(space|invalid)(\/|$)/.test(raw)) external.add(raw);
        continue;
      }
      internal.push({ page, raw });
    }
  }
}

const bad = [];
for (const { page, raw } of internal) {
  const [path, hash] = raw.split('#');
  const target = path === '' ? page : path;
  if (files.has(target)) continue;
  const p = resolvePage(target);
  if (!p) { bad.push(`${page} → ${raw}（文件不存在）`); continue; }
  if (hash && !idsOf(pages.get(p)).has(hash)) bad.push(`${page} → ${raw}（锚点不存在）`);
}

let okExt = 0;
for (const url of external) {
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (r.ok) okExt++;
    else bad.push(`外链 HTTP ${r.status}：${url}`);
  } catch (e) {
    bad.push(`外链无法访问：${url}（${e.message}）`);
  }
}

console.log(`站内链接 ${internal.length} 个，外链 ${external.size} 个（可达 ${okExt}）。`);
if (bad.length) {
  bad.forEach((b) => console.error('  ✗ ' + b));
  process.exit(1);
}
console.log('链接检查通过。');
