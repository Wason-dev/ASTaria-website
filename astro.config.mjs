import { defineConfig } from 'astro/config';

// 部署域名尚未确定；部署时通过 SITE_URL 注入，Open Graph 绝对地址依赖它。
export default defineConfig({
  site: process.env.SITE_URL || 'https://astaria.invalid',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
