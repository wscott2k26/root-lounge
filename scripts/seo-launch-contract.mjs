import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readMaybe(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

const helper = await readMaybe('recovered-live/helper.js');
const vercel = await readMaybe('vercel.json');
const robots = await readMaybe('robots.txt');
const sitemap = await readMaybe('sitemap.xml');

assert.match(helper, /SEO_CANONICAL='https:\/\/www\.uptimelounge\.com\/'/, 'Runtime SEO metadata must use the production canonical URL');
assert.ok(helper.includes("setAttribute('rel','canonical')"), 'Runtime must expose a canonical link element');
assert.ok(helper.includes("name','robots'"), 'Runtime must expose an indexable robots meta tag');
assert.ok(helper.includes("property','og:url'"), 'Runtime must expose the canonical Open Graph URL');
assert.ok(vercel.includes('<https://www.uptimelounge.com/>; rel="canonical"'), 'Vercel must emit a canonical Link header before JavaScript runs');
assert.ok(vercel.includes('X-Robots-Tag'), 'Vercel must emit an indexable X-Robots-Tag header');

assert.match(robots, /^User-agent: \*$/m, 'robots.txt must define a global user agent');
assert.match(robots, /^Allow: \/$/m, 'robots.txt must allow the public site');
assert.match(robots, /^Disallow: \/api\/$/m, 'robots.txt must keep API routes out of search results');
assert.match(robots, /^Sitemap: https:\/\/www\.uptimelounge\.com\/sitemap\.xml$/m, 'robots.txt must advertise the production sitemap');

assert.match(sitemap, /<loc>https:\/\/www\.uptimelounge\.com\/<\/loc>/, 'sitemap.xml must contain the canonical homepage');
assert.match(sitemap, /<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/, 'sitemap.xml must use the standard sitemap namespace');

console.log('UPTIME LOUNGE SEO LAUNCH CONTRACT: PASS');
