import { defineConfig } from 'astro/config';

// 正式域名 astaria.space。预览部署可以用 SITE_URL 覆盖；Open Graph、canonical 与 sitemap 的绝对地址都依赖它。
export default defineConfig({
  site: process.env.SITE_URL || 'https://astaria.space',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
