#!/usr/bin/env node
/**
 * 静态内容页构建器。
 *
 *   node scripts/build-pages.js
 *
 * 读取 content/pages.js（双语内容源），生成：
 *   public/<slug>/index.html       英文版
 *   public/zh/<slug>/index.html    中文版
 *   public/404.html                404 页（含站内导航）
 *   public/sitemap.xml             真实 URL + hreflang 备用链接
 *
 * 生成文件进仓库，同时接到 Render 的 buildCommand 上，改文案后重新构建即可。
 */

const fs = require("node:fs");
const path = require("node:path");
const { pages, nav, footerLinks, SITE, UPDATED, CONTACT_EMAIL } = require("../content/pages");

const publicDir = path.join(__dirname, "..", "public");

const LANGS = {
  en: { htmlLang: "en", prefix: "", label: "English", switchLabel: "中文", switchHref: zh => zh },
  zh: { htmlLang: "zh-CN", prefix: "/zh", label: "中文", switchLabel: "EN", switchHref: enHref => enHref }
};

const brandMark = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><ellipse cx="24" cy="24" rx="23" ry="10" transform="rotate(-48 24 24)" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="11" cy="29" r="3" fill="currentColor"/><circle cx="34" cy="10" r="3" fill="currentColor"/><circle cx="28" cy="29" r="2.5" fill="currentColor"/></svg>`;

function urlFor(lang, slug) {
  const prefix = lang === "zh" ? "/zh" : "";
  return `${SITE}${prefix}/${slug}/`;
}

function pathFor(lang, slug) {
  const prefix = lang === "zh" ? "/zh" : "";
  return `${prefix}/${slug}/`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBadge(badge, lang) {
  const map = {
    live: { cls: "badge-live", en: "Live", zh: "实采" },
    demo: { cls: "badge-demo", en: "Demo", zh: "演示" },
    beta: { cls: "badge-beta", en: "Beta", zh: "测试" }
  };
  const item = map[badge];
  if (!item) return "";
  return `<span class="badge ${item.cls}">${esc(item[lang])}</span>`;
}

function renderTable(table, lang) {
  const head = table.head[lang].map(cell => `<th scope="col">${esc(cell)}</th>`).join("");
  const rows = table.rows
    .map(row => {
      const cells = row[lang]
        .map(cell => {
          if (cell && typeof cell === "object" && cell.badge) return `<td>${renderBadge(cell.badge, lang)}</td>`;
          return `<td>${cell}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderHeader(page, lang) {
  const current = page ? page.slug : "";
  const navLinks = nav
    .map(item => {
      const href = lang === "zh" ? item.hrefZh : item.href;
      const isCurrent = item.match === current;
      return `<a href="${href}"${isCurrent ? ' aria-current="page"' : ""}>${esc(item.label[lang])}</a>`;
    })
    .join("");
  const switchHref = page ? (lang === "zh" ? pathFor("en", page.slug) : pathFor("zh", page.slug)) : "/";
  return `<header class="site-header">
      <div class="page-wrap">
        <a class="site-brand" href="/">
          ${brandMark}
          <span>AdRadarHub<small>${lang === "zh" ? "海外广告情报" : "Overseas ads intelligence"}</small></span>
        </a>
        <nav class="site-nav" aria-label="${lang === "zh" ? "主导航" : "Main"}">
          ${navLinks}
          <a class="nav-cta" href="/">${lang === "zh" ? "打开工具" : "Open the tool"}</a>
          <a class="lang-link" href="${switchHref}" hreflang="${lang === "zh" ? "en" : "zh-CN"}" rel="alternate">${lang === "zh" ? "EN" : "中文"}</a>
        </nav>
      </div>
    </header>`;
}

function renderFooter(lang) {
  const links = footerLinks
    .map(item => `<a href="${lang === "zh" ? item.hrefZh : item.href}">${esc(item.label[lang])}</a>`)
    .join("");
  return `<footer class="site-footer">
      <div class="page-wrap">
        <span>© ${new Date().getFullYear()} AdRadarHub · ${lang === "zh" ? "海外广告情报" : "Overseas ads intelligence"}</span>
        <nav aria-label="${lang === "zh" ? "页脚导航" : "Footer"}">${links}</nav>
      </div>
    </footer>`;
}

function renderToc(page, lang) {
  if (!page.sections || !page.sections.length) return "";
  const items = page.sections.map(section => `<li><a href="#${section.id}">${esc(section.h2[lang])}</a></li>`).join("");
  return `<aside class="doc-aside">
        <h2>${esc(page.toc[lang])}</h2>
        <ul>${items}</ul>
        <div class="aside-cta">
          <p>${esc(page.asideCta[lang])}</p>
          <a class="btn" href="${page.ctaHref || "/"}">${lang === "zh" ? "开始扫描" : "Run a scan"}</a>
        </div>
      </aside>`;
}

function renderBody(page, lang) {
  const blocks = [];

  if (page.sections) {
    for (const section of page.sections) {
      blocks.push(`<h2 id="${section.id}">${esc(section.h2[lang])}</h2>`);
      blocks.push(section.body[lang]);
      if (section.table) blocks.push(renderTable(section.table, lang));
    }
  }

  if (page.faq) {
    const items = page.faq
      .map(
        (item, index) => `<div class="faq-item">
          <h3 id="q${index + 1}">${esc(item.q[lang])}</h3>
          <p>${item.a[lang]}</p>
        </div>`
      )
      .join("");
    blocks.push(`<div class="faq-list">${items}</div>`);
  }

  return blocks.join("\n");
}

function buildJsonLd(page, lang) {
  const url = urlFor(lang, page.slug);
  const graphs = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: lang === "zh" ? "首页" : "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: page.h1[lang], item: url }
      ]
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.title[lang],
      description: page.description[lang],
      inLanguage: lang === "zh" ? "zh-CN" : "en",
      dateModified: UPDATED,
      isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website`, name: "AdRadarHub", url: `${SITE}/` },
      about: { "@type": "SoftwareApplication", name: "AdRadarHub", applicationCategory: "BusinessApplication" }
    }
  ];

  if (page.faq) {
    graphs.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: page.faq.map(item => ({
        "@type": "Question",
        name: item.q[lang],
        acceptedAnswer: { "@type": "Answer", text: item.a[lang] }
      }))
    });
  }

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graphs }, null, 2);
}

function renderPage(page, lang) {
  const url = urlFor(lang, page.slug);
  const altEn = urlFor("en", page.slug);
  const altZh = urlFor("zh", page.slug);
  const switchHref = lang === "zh" ? pathFor("en", page.slug) : pathFor("zh", page.slug);

  return `<!doctype html>
<html lang="${LANGS[lang].htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(page.title[lang])} · AdRadarHub</title>
    <meta name="description" content="${esc(page.description[lang])}" />
    <link rel="canonical" href="${url}" />
    <link rel="alternate" hreflang="en" href="${altEn}" />
    <link rel="alternate" hreflang="zh-CN" href="${altZh}" />
    <link rel="alternate" hreflang="x-default" href="${altEn}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="AdRadarHub" />
    <meta property="og:title" content="${esc(page.title[lang])}" />
    <meta property="og:description" content="${esc(page.description[lang])}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}/og/og-default.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${lang === "zh" ? "zh_CN" : "en_US"}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(page.title[lang])}" />
    <meta name="twitter:description" content="${esc(page.description[lang])}" />
    <meta name="twitter:image" content="${SITE}/og/og-default.png" />
    <meta name="theme-color" content="#f5f7fc" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/pages.css" />
    <script type="application/ld+json">
${buildJsonLd(page, lang)}
    </script>
    <!--SITE_TAGS-->
  </head>
  <body>
    <div class="page-shell">
      ${renderHeader(page, lang)}
      <main class="page-main">
        <div class="page-wrap doc-grid">
          <article class="doc-body">
            <nav class="breadcrumb" aria-label="${lang === "zh" ? "面包屑" : "Breadcrumb"}">
              <a href="/">${lang === "zh" ? "首页" : "Home"}</a>
              <span aria-hidden="true">/</span>
              <span>${esc(page.h1[lang])}</span>
            </nav>
            <p class="eyebrow">${esc(page.eyebrow[lang])}</p>
            <h1>${esc(page.h1[lang])}</h1>
            <p class="lead">${esc(page.lead[lang])}</p>
            <p class="updated">${lang === "zh" ? "最后更新" : "Last updated"} · ${UPDATED}</p>
            ${renderBody(page, lang)}
          </article>
          ${renderToc(page, lang)}
        </div>
      </main>
      ${renderFooter(lang)}
    </div>
    <script>
      // 语言偏好与工作台保持一致（?lang 优先，其次 localStorage）
      (function () {
        var params = new URLSearchParams(location.search);
        var forced = params.get("lang");
        if (forced) localStorage.setItem("atr_lang", forced);
      })();
    </script>
  </body>
</html>
`;
}

function writePage(lang, slug, html) {
  const dir = lang === "zh" ? path.join(publicDir, "zh", slug) : path.join(publicDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
  return path.relative(publicDir, path.join(dir, "index.html"));
}

function buildNotFound() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Page not found · AdRadarHub</title>
    <meta name="description" content="This page does not exist. Browse the ad library guide, data sources, or head back to the tool." />
    <meta name="robots" content="noindex, follow" />
    <meta name="theme-color" content="#f5f7fc" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/pages.css" />
    <!--SITE_TAGS-->
  </head>
  <body>
    <div class="page-shell">
      ${renderHeader(null, "en")}
      <main class="page-main">
        <div class="page-wrap doc-body" style="max-width: 720px">
          <p class="eyebrow">404</p>
          <h1>This page does not exist</h1>
          <p class="lead">The link may be outdated. Everything below is still where it should be.</p>
          <ul>
            <li><a href="/">The tool — scan a domain for live ad intelligence</a></li>
            <li><a href="/ad-library/">How to check the ads your competitors are running</a></li>
            <li><a href="/data-sources/">Data sources, coverage and limits</a></li>
            <li><a href="/faq/">Frequently asked questions</a></li>
            <li><a href="/zh/">中文版</a></li>
          </ul>
          <p style="color: var(--dim); font-size: 14px">页面不存在，可从上面的链接继续。有问题请联系 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>。</p>
        </div>
      </main>
      ${renderFooter("en")}
    </div>
  </body>
</html>
`;
  fs.writeFileSync(path.join(publicDir, "404.html"), html, "utf8");
  return "404.html";
}

function buildSitemap() {
  const entries = [
    { loc: `${SITE}/`, alternates: false, changefreq: "daily", priority: "1.0" }
  ];
  for (const page of pages) {
    entries.push({
      loc: urlFor("en", page.slug),
      alternates: { en: urlFor("en", page.slug), zh: urlFor("zh", page.slug) },
      changefreq: "monthly",
      priority: page.slug === "ad-library" || page.slug === "data-sources" ? "0.8" : "0.5"
    });
    entries.push({
      loc: urlFor("zh", page.slug),
      alternates: { en: urlFor("en", page.slug), zh: urlFor("zh", page.slug) },
      changefreq: "monthly",
      priority: page.slug === "ad-library" || page.slug === "data-sources" ? "0.8" : "0.5"
    });
  }

  const body = entries
    .map(entry => {
      const alternates = entry.alternates
        ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${entry.alternates.en}" />` +
          `\n    <xhtml:link rel="alternate" hreflang="zh-CN" href="${entry.alternates.zh}" />` +
          `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${entry.alternates.en}" />`
        : "";
      return `  <url>\n    <loc>${entry.loc}</loc>${alternates}\n    <lastmod>${UPDATED}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf8");
  return "sitemap.xml";
}

function main() {
  const written = [];
  for (const page of pages) {
    written.push(writePage("en", page.slug, renderPage(page, "en")));
    written.push(writePage("zh", page.slug, renderPage(page, "zh")));
  }
  written.push(buildNotFound());
  written.push(buildSitemap());
  console.log(`Built ${written.length} files:`);
  for (const file of written) console.log(`  public/${file}`);
}

main();
