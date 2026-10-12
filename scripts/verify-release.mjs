// 核对 src/data/release.ts 与 GitHub Release 的公开信息逐项一致。
// 只用公开 API，不需要也不读取任何 Token。用法：npm run verify:release
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../src/data/release.ts', import.meta.url), 'utf8');
const pick = (re) => (src.match(re) ?? [])[1];
const repo = pick(/repo:\s*'([^']+)'/);
const tag = pick(/tag:\s*'([^']+)'/);
const version = pick(/version:\s*'([^']+)'/);
const publishedAt = pick(/publishedAt:\s*'([^']+)'/);
const prerelease = pick(/prerelease:\s*(true|false)/) === 'true';
const assets = [...src.matchAll(/fileName:\s*'([^']+)',\s*sizeBytes:\s*(\d+),\s*sha256:\s*'([0-9a-f]{64})'/g)].map((m) => ({
  name: m[1], size: Number(m[2]), sha256: m[3],
}));

const fail = [];
const ok = [];
if (!repo || !tag) fail.push('release.ts 缺少 repo 或 tag');
if (tag !== `v${version}`) fail.push(`tag (${tag}) 与 version (${version}) 不对应`);

const get = async (url, init) => {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(20000) }); }
  catch (e) { console.error(`网络不可用，无法核对：${url}（${e.cause?.code ?? e.message}）`); process.exit(2); }
};
const res = await get(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers: { Accept: 'application/vnd.github+json' } });
if (!res.ok) {
  console.error(`无法读取 ${repo} ${tag}：HTTP ${res.status}`);
  process.exit(2);
}
const rel = await res.json();
if (rel.draft) fail.push('Release 仍是草稿');
if (rel.prerelease !== prerelease) fail.push(`prerelease 不一致：manifest ${prerelease}，GitHub ${rel.prerelease}`);
if (rel.published_at !== publishedAt) fail.push(`publishedAt 不一致：manifest ${publishedAt}，GitHub ${rel.published_at}`);
else ok.push(`发布时间 ${publishedAt}`);

const remote = new Map(rel.assets.map((a) => [a.name, a]));
for (const a of assets) {
  const r = remote.get(a.name);
  if (!r) { fail.push(`GitHub 上没有资产 ${a.name}`); continue; }
  if (r.state !== 'uploaded') fail.push(`${a.name} 状态为 ${r.state}`);
  if (r.size !== a.size) fail.push(`${a.name} 大小不一致：manifest ${a.size}，GitHub ${r.size}`);
  const digest = (r.digest ?? '').replace(/^sha256:/, '');
  if (!digest) fail.push(`${a.name} 在 GitHub 上没有 digest，无法自动核对 SHA-256`);
  else if (digest !== a.sha256) fail.push(`${a.name} SHA-256 不一致`);
  if (!remote.has(`${a.name}.sha256`)) fail.push(`缺少校验文件 ${a.name}.sha256`);
  if (r.size === a.size && digest === a.sha256) ok.push(`${a.name}  ${a.size} B  sha256 ✓`);
}

// 下载链接必须真的可达（只发 HEAD，不下载文件本体）。
for (const a of assets) {
  const url = `https://github.com/${repo}/releases/download/${tag}/${a.name}`;
  const h = await get(url, { method: 'HEAD', redirect: 'follow' });
  if (!h.ok) fail.push(`下载链接不可达（HTTP ${h.status}）：${url}`);
  else ok.push(`可达 ${url}`);
}

ok.forEach((l) => console.log('  ok  ' + l));
if (fail.length) {
  fail.forEach((l) => console.error('  ✗   ' + l));
  process.exit(1);
}
console.log(`\nrelease.ts 与 ${repo} ${tag} 一致（${assets.length} 个安装包）。`);
