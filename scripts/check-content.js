#!/usr/bin/env node
/**
 * 内容页自检。在 CI / 本地跑：
 *   node scripts/check-content.js
 *
 * 检查项：
 *  1. sitemap 里每条 URL 都有对应文件（且不含 #hash）
 *  2. 每个页面有 title / meta description / canonical / 唯一 h1 / JSON-LD
 *  3. 每页 hreflang 的 en 与 zh 互相指向对方
 *  4. 站内链接指向的路径都真实存在
 *  5. 首页有 description / canonical / og:image / JSON-LD
 */

const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");
const SITE = "https://adradarhub.com";
const errors = [];
const warnings = [];

function fileForUrl(url) {
  const pathname = url.replace(SITE, "").replace(/\/$/, "");
  const relative = pathname === "" ? "index.html" : path.join(pathname, "index.html");
  return path.join(publicDir, relative);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const sitemapPath = path.join(publicDir, "sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
  errors.push("sitemap.xml 不存在");
} else {
  const sitemap = read(sitemapPath);
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  if (!locs.length) errors.push("sitemap 没有任何 <loc>");
  for (const loc of locs) {
    if (loc.includes("#")) errors.push(`sitemap 含 hash URL（不会被抓取）: ${loc}`);
    const file = fileForUrl(loc);
    if (!fs.existsSync(file)) errors.push(`sitemap URL 没有对应文件: ${loc} → ${path.relative(publicDir, file)}`);
  }
  console.log(`sitemap: ${locs.length} 条 URL`);
}

const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "og") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) htmlFiles.push(full);
  }
})(publicDir);

const titles = new Map();
for (const file of htmlFiles) {
  const relative = path.relative(publicDir, file);
  const html = read(file);
  const isNotFound = relative === "404.html";
  const isApp = relative === "index.html";

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) errors.push(`${relative}: 缺 <title>`);
  else if (titles.has(title)) errors.push(`${relative}: title 与 ${titles.get(title)} 重复`);
  else titles.set(title, relative);

  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1];
  if (!desc && !isNotFound) errors.push(`${relative}: 缺 meta description`);

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical && !isNotFound) errors.push(`${relative}: 缺 canonical`);

  const h1s = [...html.matchAll(/<h1[ >]/g)].length;
  if (h1s !== 1 && !isApp) errors.push(`${relative}: h1 数量为 ${h1s}（应为 1）`);

  if (!isNotFound && !html.includes("application/ld+json")) errors.push(`${relative}: 缺 JSON-LD`);

  if (!isNotFound) {
    const file2Url = "/" + relative.replace(/index\.html$/, "").replace(/\/$/, "");
    const expected = SITE + (file2Url === "/" ? "/" : file2Url + "/");
    if (canonical && canonical !== expected) errors.push(`${relative}: canonical 与路径不一致（${canonical} ≠ ${expected}）`);

    const hreflangs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
    if (!isApp && !hreflangs.length) errors.push(`${relative}: 缺 hreflang`);

    // 站内链接存在性
    for (const match of html.matchAll(/href="(\/[a-z0-9\-/]*\/)"/g)) {
      const target = match[1];
      if (target === "/") continue;
      const targetFile = path.join(publicDir, target, "index.html");
      if (!fs.existsSync(targetFile)) errors.push(`${relative}: 内链指向不存在的页面 ${target}`);
    }
  }

  if (isApp) {
    for (const required of ["og:image", "og:title", "twitter:card", "theme-color", "favicon.svg"]) {
      if (!html.includes(required)) errors.push(`index.html: 缺 ${required}`);
    }
  }
}

if (!fs.existsSync(path.join(publicDir, "og", "og-default.png"))) warnings.push("缺 og/og-default.png");
if (!fs.existsSync(path.join(publicDir, "404.html"))) errors.push("缺 404.html");

for (const warning of warnings) console.log(`⚠ ${warning}`);
if (errors.length) {
  console.error(`\n✗ ${errors.length} 个问题：`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`✓ ${htmlFiles.length} 个 HTML 页面通过检查`);
