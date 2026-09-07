import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readMaybe(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

const index = await readMaybe('index.html');
const robots = await readMaybe('robots.txt');
const sitemap = await readMaybe('sitemap.xml');

assert.match(index, /<title>Uptime Lounge<\/title>/, 'Server HTML title must use the public Uptime Lounge brand');
assert.match(index, /<meta name="description" content="Uptime Lounge — a decompression workspace for SysAdmins, SREs, developers, and IT teams\."\s*\/?>/, 'Server HTML must expose the canonical Uptime Lounge description');
assert.match(index, /<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"\s*\/?>/, 'Homepage must explicitly allow indexing');
assert.match(index, /<link rel="canonical" href="https:\/\/www\.uptimelounge\.com\/"\s*\/?>/, 'Homepage canonical must point to the production www URL');
assert.match(index, /<meta property="og:url" content="https:\/\/www\.uptimelounge\.com\/"\s*\/?>/, 'Open Graph URL must match the canonical URL');

assert.match(robots, /^User-agent: \*$/m, 'robots.txt must define a global user agent');
assert.match(robots, /^Allow: \/$/m, 'robots.txt must allow the public site');
assert.match(robots, /^Disallow: \/api\/$/m, 'robots.txt must keep API routes out of search results');
assert.match(robots, /^Sitemap: https:\/\/www\.uptimelounge\.com\/sitemap\.xml$/m, 'robots.txt must advertise the production sitemap');

assert.match(sitemap, /<loc>https:\/\/www\.uptimelounge\.com\/<\/loc>/, 'sitemap.xml must contain the canonical homepage');
assert.match(sitemap, /<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/, 'sitemap.xml must use the standard sitemap namespace');

console.log('UPTIME LOUNGE SEO LAUNCH CONTRACT: PASS');
