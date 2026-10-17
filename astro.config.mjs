import { defineConfig } from 'astro/config';

// 正式域名 astaria.space。预览部署可以用 SITE_URL 覆盖；Open Graph、canonical 与 sitemap 的绝对地址都依赖它。
export default defineConfig({
  site: process.env.SITE_URL || 'https://astaria.space',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  // CSS 按 Safari 15 / iOS 15 起编译：压缩时保留 -webkit-backdrop-filter 等前缀。
  // 默认目标较新，会删掉前缀，老 iPad（iPadOS 17 及更早）上的玻璃磨砂就完全消失。
  vite: { build: { cssTarget: ['chrome100', 'edge100', 'firefox100', 'safari15', 'ios15'] } },
});
