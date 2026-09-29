// Google Analytics 4 connector（Analytics Data API v1beta）。
// 拉的是"进站之后发生了什么"：渠道结构、落地页表现、互动质量和转化。
// GSC 看需求侧（曝光/排名），GA4 看供给侧（承接/转化），两者拼起来才完整。
//
// 官方文档：https://developers.google.com/analytics/devguides/reporting/data/v1
// 配额：每个媒体资源 5,000 token/小时 + 25,000/天（免费）。
const { getAccessToken } = require("../googleAuth");

const API_BASE = "https://analyticsdata.googleapis.com/v1beta";

// GA4 当天数据通常要隔天才完整，默认截止到昨天。
const DEFAULT_DELAY_DAYS = 1;

// 指标名在 2024 年后从 conversions 迁移到 keyEvents，不同媒体资源支持的版本不一样，
// 先试 conversions，报错再退回 keyEvents（返回结构完全一致，字段名统一成 conversions）。
const CONVERSION_METRICS = ["conversions", "keyEvents"];

async function fetchGa4Data(query = {}) {
  const propertyId = resolvePropertyId(query.propertyId || process.env.GA4_PROPERTY_ID);
  if (!propertyId) {
    throw new Error("ga4_property_id_missing: 未配置 GA4 媒体资源 ID（GA4 → 管理 → 媒体资源设置，纯数字）");
  }

  const sinceDays = clampInt(Number(query.sinceDays || process.env.GA4_SINCE_DAYS || 28), 3, 180);
  const delayDays = clampInt(Number(process.env.GA4_DATA_DELAY_DAYS || DEFAULT_DELAY_DAYS), 0, 5);
  const range = dateRange(sinceDays, delayDays);
  const token = await getAccessToken("ga4");

  const [overview, daily, channels, pages, geo] = await Promise.all([
    runReport(token, propertyId, {
      dateRanges: [range],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
        { name: CONVERSION_METRICS[0] }
      ]
    }).catch(error => retryWithKeyEvents(token, propertyId, range, error)),
    runReport(token, propertyId, {
      dateRanges: [range],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: CONVERSION_METRICS[0] }],
      orderBys: [{ dimension: { dimensionName: "date" } }]
    }).catch(() => ({ rows: [] })),
    runReport(token, propertyId, {
      dateRanges: [range],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }, { name: CONVERSION_METRICS[0] }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 12
    }).catch(() => ({ rows: [] })),
    runReport(token, propertyId, {
      dateRanges: [range],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "engagementRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20
    }).catch(() => ({ rows: [] })),
    runReport(token, propertyId, {
      dateRanges: [range],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10
    }).catch(() => ({ rows: [] }))
  ]);

  const totals = readTotals(overview, [
    "activeUsers",
    "sessions",
    "screenPageViews",
    "engagementRate",
    "averageSessionDuration",
    "conversions"
  ]);

  const warnings = [];
  if (!totals.sessions) {
    warnings.push(`GA4 在 ${range.startDate} ~ ${range.endDate} 内没有会话数据：数据流可能未接入或 ID 填错。`);
  }

  return {
    source: "ga4",
    sourceMode: "live",
    propertyId,
    range,
    totals,
    daily: readRows(daily, ["date"], ["activeUsers", "sessions", "conversions"]),
    channels: readRows(
      channels,
      ["sessionDefaultChannelGroup"],
      ["sessions", "activeUsers", "engagementRate", "conversions"]
    ),
    pages: readRows(pages, ["pagePath"], ["screenPageViews", "activeUsers", "engagementRate"]),
    countries: readRows(geo, ["country"], ["activeUsers", "sessions"]),
    warnings
  };
}

async function retryWithKeyEvents(token, propertyId, range, error) {
  const message = String(error && error.message ? error.message : error);
  if (!/conversions/i.test(message)) throw error;
  return runReport(token, propertyId, {
    dateRanges: [range],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
      { name: CONVERSION_METRICS[1] }
    ]
  });
}

async function runReport(token, propertyId, body) {
  const url = `${API_BASE}/properties/${encodeURIComponent(propertyId)}:runReport`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000))
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.error?.message || payload.message || "";
    if (response.status === 403) {
      throw new Error(
        `ga4_permission_denied: 服务账号没有该 GA4 媒体资源权限。去 GA4 → 管理 → 媒体资源访问权限管理，把服务账号邮箱加为「查看者」。${detail}`
      );
    }
    if (response.status === 404) {
      throw new Error(`ga4_property_not_found: 媒体资源 ID ${propertyId} 不存在或已删除。${detail}`);
    }
    throw new Error(`ga4_api_failed:${response.status}:${detail}`);
  }
  return payload;
}

function readTotals(report, metricNames) {
  const values = report?.totals?.[0]?.metricValues || [];
  const result = {};
  metricNames.forEach((name, index) => {
    result[name] = Number(values[index]?.value || 0);
  });
  // 比率与时长类指标取整体聚合值，不能直接累加。
  result.engagementRate = Number(report?.totals?.[0]?.metricValues?.[3]?.value || 0);
  return normalizeMetrics(result);
}

function readRows(report, dimensionNames, metricNames) {
  const rows = report?.rows || [];
  return rows.map(row => {
    const item = {};
    dimensionNames.forEach((name, index) => {
      item[name] = row.dimensionValues?.[index]?.value || "";
    });
    metricNames.forEach((name, index) => {
      item[name] = Number(row.metricValues?.[index]?.value || 0);
    });
    return normalizeMetrics(item, metricNames);
  });
}

function normalizeMetrics(item, metricNames) {
  const keys = metricNames || Object.keys(item);
  keys.forEach(key => {
    if (key === "engagementRate") return;
    if (typeof item[key] === "number") item[key] = Math.round(item[key] * 100) / 100;
  });
  return item;
}

function resolvePropertyId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // 有人在后台复制的是 properties/123456789 或整段 URL，这里统一取数字段。
  const match = raw.match(/(\d{6,})/);
  return match ? match[1] : "";
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

function getGa4Status() {
  const configured =
    Boolean(
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
        (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN)
    ) && Boolean(resolvePropertyId(process.env.GA4_PROPERTY_ID));
  const propertyId = resolvePropertyId(process.env.GA4_PROPERTY_ID);

  return {
    platform: "ga4",
    label: "Google Analytics 4",
    configured,
    mode: configured ? "live-ready" : "demo",
    route: configured ? "official-api" : "demo",
    access: "service-account",
    envKey: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    directKey: "GA4_PROPERTY_ID",
    missing: configured
      ? []
      : ["GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GA4_PROPERTY_ID"],
    detail: propertyId ? `property=${propertyId}` : "未配置 GA4 媒体资源 ID",
    sourceUrl: "https://analytics.google.com/"
  };
}

function createGa4Demo(query = {}) {
  const host = String(query.website || "adradarhub.com").replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const sinceDays = clampInt(Number(query.sinceDays || 28), 3, 180);
  const range = dateRange(sinceDays, DEFAULT_DELAY_DAYS);
  const random = seededRandom(host);

  const channels = [
    ["Organic Search", 0.42],
    ["Direct", 0.2],
    ["Paid Search", 0.17],
    ["Organic Social", 0.1],
    ["Referral", 0.08],
    ["Display", 0.03]
  ].map(([channel, share]) => {
    const sessions = Math.round(2400 * share * (0.8 + random() * 0.4));
    const engagementRate = Number((0.35 + random() * 0.35).toFixed(4));
    return {
      sessionDefaultChannelGroup: channel,
      sessions,
      activeUsers: Math.round(sessions * (0.7 + random() * 0.25)),
      engagementRate,
      conversions: Math.round(sessions * (0.01 + random() * 0.05))
    };
  });

  const pages = ["/", "/#ads", "/#trends", "/#iteration", "/#generate"].map(path => {
    const screenPageViews = Math.round(300 + random() * 2400);
    return {
      pagePath: path,
      screenPageViews,
      activeUsers: Math.round(screenPageViews * (0.45 + random() * 0.3)),
      engagementRate: Number((0.25 + random() * 0.45).toFixed(4))
    };
  });

  const daily = Array.from({ length: sinceDays }, (_, index) => {
    const date = new Date(Date.parse(range.startDate) + index * 86400000);
    const sessions = Math.round(60 + random() * 90);
    return {
      date: toIsoDate(date),
      activeUsers: Math.round(sessions * (0.7 + random() * 0.2)),
      sessions,
      conversions: Math.round(sessions * (0.01 + random() * 0.04))
    };
  });

  const sessions = channels.reduce((sum, item) => sum + item.sessions, 0);
  const conversions = channels.reduce((sum, item) => sum + item.conversions, 0);

  return {
    source: "ga4",
    sourceMode: "demo",
    propertyId: "demo",
    range,
    totals: {
      activeUsers: Math.round(sessions * 0.72),
      sessions,
      screenPageViews: Math.round(sessions * 2.4),
      engagementRate: 0.52,
      averageSessionDuration: 96,
      conversions
    },
    daily,
    channels,
    pages,
    countries: [
      { country: "United States", activeUsers: 620, sessions: 840 },
      { country: "United Kingdom", activeUsers: 180, sessions: 240 },
      { country: "Germany", activeUsers: 120, sessions: 160 }
    ],
    warnings: [
      "GA4 未配置，当前为演示数据。配置 GOOGLE_SERVICE_ACCOUNT_* 与 GA4_PROPERTY_ID 后自动切 live。"
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
  fetchGa4Data,
  getGa4Status,
  createGa4Demo,
  resolvePropertyId
};
