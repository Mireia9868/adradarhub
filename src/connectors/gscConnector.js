// Google Search Console connector（Webmasters Search Analytics API v3）。
// 拉的是"自然搜索"这一侧的真实表现：曝光、点击、CTR、排名。
// 广告侧数据在 Bing/Meta/Google 透明度中心，这里补的是搜索需求侧，
// 两边拼起来才能判断"某个词该投广告还是该做内容"。
//
// 官方文档：https://developers.google.com/webmaster-tools/v1/searchanalytics/query
// 配额：每个媒体资源 1,200 QPM / 每天 50,000 次请求（免费，够用）。
const { getAccessToken } = require("../googleAuth");

const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

// GSC 数据有 2~3 天延迟，取到"今天"会看到末尾几天全是 0，默认回退 2 天。
const DEFAULT_DELAY_DAYS = 2;

async function fetchGscData(query = {}) {
  const siteUrl = resolveSiteUrl(query.siteUrl || query.website || process.env.GSC_SITE_URL);
  if (!siteUrl) {
    throw new Error("gsc_site_url_missing: 未指定 GSC 媒体资源（sc-domain:example.com 或 https://example.com/）");
  }

  const sinceDays = clampInt(Number(query.sinceDays || process.env.GSC_SINCE_DAYS || 28), 3, 180);
  const delayDays = clampInt(Number(process.env.GSC_DATA_DELAY_DAYS || DEFAULT_DELAY_DAYS), 0, 5);
  const rowLimit = clampInt(Number(process.env.GSC_ROW_LIMIT || 100), 1, 25000);
  const searchType = process.env.GSC_SEARCH_TYPE || "web";
  const range = dateRange(sinceDays, delayDays);

  const token = await getAccessToken("gsc");

  const [totals, byQuery, byPage, byCountry, byDevice] = await Promise.all([
    runQuery(token, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["date"],
      rowLimit,
      type: searchType
    }),
    runQuery(token, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["query"],
      rowLimit,
      type: searchType
    }),
    runQuery(token, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["page"],
      rowLimit,
      type: searchType
    }),
    runQuery(token, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["country"],
      rowLimit: 20,
      type: searchType
    }).catch(() => ({ rows: [] })),
    runQuery(token, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["device"],
      rowLimit: 10,
      type: searchType
    }).catch(() => ({ rows: [] }))
  ]);

  const daily = (totals.rows || [])
    .map(row => ({
      date: row.keys[0],
      clicks: Math.round(row.clicks || 0),
      impressions: Math.round(row.impressions || 0)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const queries = (byQuery.rows || []).map(mapRow("query"));
  const pages = (byPage.rows || []).map(mapRow("page"));
  const countries = (byCountry.rows || []).map(row => ({
    country: row.keys[0],
    clicks: Math.round(row.clicks || 0),
    impressions: Math.round(row.impressions || 0)
  }));
  const devices = (byDevice.rows || []).map(row => ({
    device: row.keys[0],
    clicks: Math.round(row.clicks || 0),
    impressions: Math.round(row.impressions || 0)
  }));

  const warnings = [];
  if (!queries.length && !pages.length) {
    warnings.push(`GSC 在 ${range.startDate} ~ ${range.endDate} 内没有返回数据：媒体资源可能刚验证或索引量为 0。`);
  }

  return {
    source: "gsc",
    sourceMode: "live",
    siteUrl,
    range,
    totals: aggregate(daily, queries),
    delta: computeDelta(daily),
    daily,
    queries: queries.slice(0, 50),
    pages: pages.slice(0, 20),
    countries: countries.slice(0, 10),
    devices,
    opportunities: findOpportunities(queries),
    warnings
  };
}

// 服务账号能访问哪些媒体资源：排查"403 用户没有权限"时第一步就是看这个列表。
async function listGscSites() {
  const token = await getAccessToken("gsc");
  const response = await request(
    `${API_BASE}/sites`,
    { method: "GET" },
    token
  );
  return (response.siteEntry || []).map(entry => ({
    siteUrl: entry.siteUrl,
    permissionLevel: entry.permissionLevel
  }));
}

function runQuery(token, siteUrl, body) {
  const url = `${API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  return request(url, { method: "POST", body: JSON.stringify(body) }, token);
}

async function request(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000))
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.error?.message || payload.message || "";
    // 403 = 服务账号没被加进该媒体资源的用户列表，是最常见的接入失败原因。
    if (response.status === 403) {
      throw new Error(
        `gsc_permission_denied: 服务账号没有该媒体资源权限。去 GSC → 设置 → 用户和权限，把服务账号邮箱加为「受限用户」或「所有者」。${detail}`
      );
    }
    if (response.status === 404) {
      throw new Error(`gsc_site_not_found: 媒体资源不存在或 siteUrl 写法不对（当前 ${decodeURIComponent(url.split("/sites/")[1]?.split("/")[0] || "")}）。${detail}`);
    }
    throw new Error(`gsc_api_failed:${response.status}:${detail}`);
  }
  return payload;
}

function mapRow(dimension) {
  return row => ({
    [dimension]: row.keys[0],
    clicks: Math.round(row.clicks || 0),
    impressions: Math.round(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0)
  });
}

function aggregate(daily, queries) {
  const clicks = queries.reduce((sum, item) => sum + item.clicks, 0);
  const impressions = queries.reduce((sum, item) => sum + item.impressions, 0);
  const weightedPosition = queries.reduce((sum, item) => sum + item.position * item.impressions, 0);
  const ctr = impressions ? clicks / impressions : 0;
  const position = impressions ? weightedPosition / impressions : 0;

  return {
    clicks: clicks || daily.reduce((sum, day) => sum + day.clicks, 0),
    impressions: impressions || daily.reduce((sum, day) => sum + day.impressions, 0),
    ctr,
    position,
    queryCount: queries.length,
    days: daily.length
  };
}

// 前后半段环比：判断趋势是往上还是往下，只看总量看不出拐点。
function computeDelta(daily) {
  if (daily.length < 8) return null;
  const half = Math.floor(daily.length / 2);
  const sum = rows => ({
    clicks: rows.reduce((total, row) => total + row.clicks, 0),
    impressions: rows.reduce((total, row) => total + row.impressions, 0)
  });
  const previous = sum(daily.slice(0, half));
  const current = sum(daily.slice(half));

  return {
    clicks: percentChange(previous.clicks, current.clicks),
    impressions: percentChange(previous.impressions, current.impressions),
    halfDays: half
  };
}

function percentChange(before, after) {
  if (!before) return after > 0 ? 1 : 0;
  return (after - before) / before;
}

// 机会词：有曝光但没吃到点击——要么排名在第 4~15 位临门一脚，要么 CTR 明显低于该排名的正常值。
// 这两类是内容/标题改动成本最低、见效最快的，也最适合直接转成广告关键词。
function findOpportunities(queries) {
  return queries
    .filter(item => item.impressions >= 50)
    .map(item => {
      const expectedCtr = expectedCtrByPosition(item.position);
      const ctrGap = expectedCtr - item.ctr;
      const reasons = [];
      if (item.position > 3 && item.position <= 15) reasons.push(`排名第 ${item.position.toFixed(1)} 位，冲进前 3 点击可翻倍级增长`);
      if (ctrGap > 0.01) reasons.push(`CTR ${(item.ctr * 100).toFixed(1)}% 低于同排名正常值 ${(expectedCtr * 100).toFixed(1)}%`);
      if (!reasons.length) return null;
      const score = Math.round(
        item.impressions * Math.max(ctrGap, 0) * 100 + (item.position > 3 && item.position <= 15 ? 40 : 0) + Math.min(item.impressions / 20, 30)
      );
      return { ...item, expectedCtr, reasons, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// 行业通用 CTR 曲线（Google 自然搜索），用来判断"这个排名本该拿到多少点击"。
function expectedCtrByPosition(position) {
  const table = [
    [1, 0.28],
    [2, 0.15],
    [3, 0.11],
    [4, 0.08],
    [5, 0.06],
    [6, 0.05],
    [7, 0.04],
    [8, 0.035],
    [9, 0.03],
    [10, 0.025]
  ];
  for (const [rank, ctr] of table) {
    if (position <= rank) return ctr;
  }
  return 0.02;
}

function resolveSiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("sc-domain:") || /^https?:\/\//i.test(raw)) return raw;

  const host = raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  // 域名资源（sc-domain:）不需要指定协议和路径，是服务账号接入时最省事的一种写法。
  return `sc-domain:${host}`;
}

function dateRange(sinceDays, delayDays) {
  const end = new Date(Date.now() - delayDays * 86400000);
  const start = new Date(end.getTime() - (sinceDays - 1) * 86400000);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end), days: sinceDays };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function clampInt(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(Math.round(number), min), max);
}

function getGscStatus() {
  const configured = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
      (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN)
  ) && Boolean(process.env.GSC_SITE_URL || process.env.GSC_DEFAULT_DOMAIN);
  const siteUrl = process.env.GSC_SITE_URL || "";

  return {
    platform: "gsc",
    label: "Google Search Console",
    configured,
    mode: configured ? "live-ready" : "demo",
    route: configured ? "official-api" : "demo",
    access: "service-account",
    envKey: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    directKey: "GSC_SITE_URL",
    missing: configured
      ? []
      : ["GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GSC_SITE_URL"],
    detail: siteUrl ? `siteUrl=${siteUrl}` : "未配置 GSC 媒体资源",
    sourceUrl: "https://search.google.com/search-console"
  };
}

// 演示数据：让页面在任何配置状态下都能跑通，同时明确标注是 demo，避免被当成真数据。
function createGscDemo(query = {}) {
  const host = String(query.website || query.siteUrl || "adradarhub.com")
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  const sinceDays = clampInt(Number(query.sinceDays || 28), 3, 180);
  const range = dateRange(sinceDays, DEFAULT_DELAY_DAYS);
  const random = seededRandom(host);

  const keywords = [
    "ad spy tool",
    "competitor ad analysis",
    "google ads transparency",
    "facebook ad library api",
    "bing ad library",
    "tiktok creative center alternative",
    "ad creative iteration",
    "overseas ppc tools"
  ];

  const queries = keywords
    .map(keyword => {
      const impressions = Math.round(400 + random() * 5200);
      const position = Number((2 + random() * 12).toFixed(1));
      const ctr = Math.max(0.004, expectedCtrByPosition(position) * (0.35 + random() * 0.5));
      return {
        query: keyword,
        clicks: Math.round(impressions * ctr),
        impressions,
        ctr: Number(ctr.toFixed(4)),
        position
      };
    })
    .sort((a, b) => b.impressions - a.impressions);

  const pages = ["/", "/#ads", "/#trends", "/#iteration"].map(path => {
    const impressions = Math.round(200 + random() * 3000);
    const ctr = Number((0.01 + random() * 0.06).toFixed(4));
    return { page: `https://${host}${path}`, clicks: Math.round(impressions * ctr), impressions, ctr, position: Number((3 + random() * 8).toFixed(1)) };
  });

  const daily = Array.from({ length: sinceDays }, (_, index) => {
    const date = toIsoDate(new Date(Date.parse(range.startDate) + index * 86400000));
    const impressions = Math.round(600 + random() * 900);
    const clicks = Math.round(impressions * (0.015 + random() * 0.03));
    return { date, clicks, impressions };
  });

  return {
    source: "gsc",
    sourceMode: "demo",
    siteUrl: `sc-domain:${host}`,
    range,
    totals: aggregate(daily, queries),
    delta: computeDelta(daily),
    daily,
    queries,
    pages,
    countries: [
      { country: "usa", clicks: 420, impressions: 9800 },
      { country: "gbr", clicks: 120, impressions: 2600 },
      { country: "deu", clicks: 80, impressions: 1900 }
    ],
    devices: [
      { device: "MOBILE", clicks: 380, impressions: 8600 },
      { device: "DESKTOP", clicks: 210, impressions: 5200 }
    ],
    opportunities: findOpportunities(queries),
    warnings: [
      "GSC 未配置，当前为演示数据。配置 GOOGLE_SERVICE_ACCOUNT_* 与 GSC_SITE_URL 后自动切 live。"
    ]
  };
}

function seededRandom(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return ((hash >>> 0) % 100000) / 100000;
  };
}

module.exports = {
  fetchGscData,
  listGscSites,
  getGscStatus,
  createGscDemo,
  resolveSiteUrl,
  findOpportunities,
  expectedCtrByPosition
};
