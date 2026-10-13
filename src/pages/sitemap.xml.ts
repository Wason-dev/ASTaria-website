// sitemap.xml：构建时按真实页面生成。/install/ 已跳转到下载页，404 不收录。
import type { APIRoute } from 'astro';
import { release } from '../data/release';

const pages = ['/', '/download/', '/changelog/', '/security/', '/faq/'];

export const GET: APIRoute = ({ site }) => {
  const base = (site ?? new URL('https://astaria.space')).href.replace(/\/$/, '');
  const lastmod = release.publishedAt.slice(0, 10);
  const urls = pages.map((p) => `  <url><loc>${base}${p}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
