// 文案与产物红线检查：扫描源码与构建产物，命中任一条即失败。
//   node scripts/verify-claims.mjs --src     扫描 src/
//   node scripts/verify-claims.mjs --dist    扫描 dist/（构建后）
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const args = new Set(process.argv.slice(2));
const roots = [args.has('--src') && 'src', args.has('--dist') && 'dist'].filter(Boolean);
if (!roots.length) roots.push('src');

// 只允许以否定形式出现的说法：命中词前 12 个字符内必须有否定词。
const NEG = /(未|没有|不|尚未|并非|不是|无|非|还没|暂无|不能|不会|禁止|不要|不等于)/;
const RULES = [
  { re: /已(经)?(通过)?(Apple )?公证/g, why: '宣称 macOS 已公证' },
  { re: /(Developer ID|Authenticode)[^。\n]{0,6}(已签名|签名完成)/g, why: '宣称已完成正式签名' },
  { re: /安全签名版/g, why: '宣称 Windows 安全签名版' },
  { re: /Windows ?11[^。\n]{0,4}(已验收|已支持|完美)/g, why: '宣称 Windows 11 已验收' },
  { re: /Beta ?13/gi, why: '出现 Beta13（下一版名为 v1.0）' },
  { re: /端到端加密/g, why: '端到端加密说法', neg: true },
  { re: /零知识/g, why: '零知识说法', neg: true },
  { re: /(下载|安装)[^。\n]{0,4}IPA/g, why: 'IPA 下载说法', neg: true },
  { re: /iOS[^。\n]{0,6}正式版/g, why: 'iOS 正式版说法', neg: true },
  { re: /(高速|极速|秒速)下载/g, why: '承诺下载速度' },
  { re: /API ?Key[^。\n]{0,8}(会|自动)同步/g, why: 'API Key 会同步', neg: true },
  { re: /v1\.0[^。\n]{0,6}(已发布|现已推出|正式发布)/g, why: 'v1.0 已发布' },
  { re: /PROJECT_ROADMAP/g, why: '私密路线图' },
  { re: /\/Users\/[A-Za-z0-9._-]+/g, why: '本地绝对路径' },
  { re: /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, why: '疑似密钥' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, why: '私钥' },
];

const TEXT = new Set(['.astro', '.ts', '.js', '.mjs', '.css', '.html', '.json', '.md', '.txt', '.svg', '.xml']);
const SKIP_FILES = new Set(['verify-claims.mjs']);
async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') yield* walk(p); }
    else if (TEXT.has(extname(e.name)) && !SKIP_FILES.has(e.name)) yield p;
  }
}

const hits = [];
for (const root of roots) {
  try { await stat(root); } catch { console.error(`跳过：${root} 不存在`); continue; }
  for await (const file of walk(root)) {
    const text = await readFile(file, 'utf8');
    for (const r of RULES) {
      for (const m of text.matchAll(r.re)) {
        const before = text.slice(Math.max(0, m.index - 12), m.index);
        if (r.neg && NEG.test(before)) continue;
        const line = text.slice(0, m.index).split('\n').length;
        hits.push(`${file}:${line}  ${r.why}  «${text.slice(Math.max(0, m.index - 16), m.index + m[0].length + 8).replace(/\s+/g, ' ')}»`);
      }
    }
  }
}
if (hits.length) {
  hits.forEach((h) => console.error('  ✗ ' + h));
  console.error(`\n${hits.length} 处违反文案或产物红线。`);
  process.exit(1);
}
console.log(`红线检查通过（${roots.join(', ')}）。`);
