const { fetchPlatformIntel, getConnectorStatus } = require("./connectors/transparency");
const { createDemoIntel } = require("./mockIntel");

const DEFAULT_MARKETS = ["US", "GB", "CA", "AU"];
const DEFAULT_PLATFORMS = ["meta", "google", "bing"];

async function createIntelReport(input) {
  const website = normalizeWebsite(input.website || input.domain || "");
  if (!website) {
    const error = new Error("website_required");
    error.statusCode = 400;
    throw error;
  }

  const markets = normalizeList(input.markets, DEFAULT_MARKETS).slice(0, 8);
  const platforms = normalizeList(input.platforms, DEFAULT_PLATFORMS).filter(platform =>
    DEFAULT_PLATFORMS.includes(platform)
  );
  const sinceDays = clamp(Number(input.sinceDays || 30), 7, 180);
  const brand = deriveBrand(website.hostname);

  const baseReport = createDemoIntel({ brand, website, markets, platforms, sinceDays });
  const liveReports = await Promise.all(
    platforms.map(platform =>
      fetchPlatformIntel(platform, { brand, website, markets, sinceDays }).catch(error => ({
        platform,
        sourceMode: "demo",
        warnings: [error.message],
        ads: [],
        trends: [],
        competitors: []
      }))
    )
  );

  const liveAds = liveReports.flatMap(report => report.ads || []);
  const liveTrends = [
    ...liveReports.flatMap(report => report.trends || []),
    ...inferTrendsFromAds(liveAds, sinceDays)
  ];
  const liveCompetitors = [
    ...liveReports.flatMap(report => report.competitors || []),
    ...inferCompetitorsFromAds(liveAds, website.hostname, brand)
  ];
  const connectorWarnings = liveReports.flatMap(report =>
    (report.warnings || []).map(message => ({ platform: report.platform, message }))
  );
  const usedLiveData = liveReports.some(report => report.sourceMode === "live");

  return {
    generatedAt: new Date().toISOString(),
    query: {
      input: input.website,
      brand,
      domain: website.hostname,
      markets,
      platforms,
      sinceDays
    },
    sourceMode: usedLiveData ? "mixed" : "demo",
    sourceStatus: getSourceStatus(),
    summary: summarizeReport(baseReport, liveAds, liveTrends, liveCompetitors),
    competitors: mergeByKey([...liveCompetitors, ...baseReport.competitors], "domain").slice(0, 10),
    trends: rankItems([...liveTrends, ...baseReport.trends], "score").slice(0, 12),
    ads: rankItems([...liveAds, ...baseReport.ads], "heat").slice(0, 30),
    warnings: [
      ...connectorWarnings,
      {
        platform: "system",
        message:
          usedLiveData
            ? "部分平台已使用 live connector，未配置的平台仍使用演示数据。"
            : "当前未配置平台授权或内部抓取代理，结果为演示数据；页面和接口流程已可运行。"
      }
    ]
  };
}

function getSourceStatus() {
  return {
    meta: getConnectorStatus("meta"),
    google: getConnectorStatus("google"),
    bing: getConnectorStatus("bing")
  };
}

function summarizeReport(baseReport, liveAds, liveTrends, liveCompetitors) {
  const allAds = [...liveAds, ...baseReport.ads];
  const hotAds = allAds.filter(ad => ad.heat >= 80).length;
  const platforms = new Set(allAds.map(ad => ad.platform));

  return {
    adsFound: allAds.length,
    hotAds,
    trendsFound: liveTrends.length + baseReport.trends.length,
    competitorsFound: liveCompetitors.length + baseReport.competitors.length,
    activePlatforms: platforms.size,
    topAngle: baseReport.trends[0]?.name || "Price-led offer"
  };
}

function normalizeWebsite(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function deriveBrand(hostname) {
  const parts = hostname.replace(/^www\./, "").split(".");
  return parts[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.map(item => String(item).trim()).filter(Boolean);
  return normalized.length ? normalized : fallback;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function rankItems(items, field) {
  return items
    .filter(Boolean)
    .sort((left, right) => Number(right[field] || 0) - Number(left[field] || 0));
}

function mergeByKey(items, key) {
  const seen = new Map();
  for (const item of items) {
    if (!item?.[key]) continue;
    if (!seen.has(item[key])) {
      seen.set(item[key], item);
    }
  }
  return [...seen.values()];
}

function inferCompetitorsFromAds(ads, targetHostname, targetBrand) {
  const targetDomain = targetHostname.replace(/^www\./, "");
  const grouped = new Map();

  for (const ad of ads) {
    const domain = getHostname(ad.landingUrl);
    if (!domain || domain === targetDomain) continue;

    const key = domain;
    const existing = grouped.get(key) || {
      name: ad.advertiser || domain,
      domain,
      overlap: 0,
      category: ad.tags?.[1] || "Live ad overlap",
      signal: `${ad.platform} creative observed`,
      source: "Live transparency connector"
    };
    existing.overlap = Math.min(98, existing.overlap + Math.max(16, Math.floor((ad.heat || 60) / 4)));
    existing.name = existing.name === targetBrand ? domain : existing.name;
    grouped.set(key, existing);
  }

  return [...grouped.values()].sort((left, right) => right.overlap - left.overlap);
}

function inferTrendsFromAds(ads, sinceDays) {
  const phraseScores = new Map();
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "your",
    "you",
    "our",
    "this",
    "that",
    "from",
    "shop",
    "learn",
    "more",
    "now",
    "get",
    "buy"
  ]);

  for (const ad of ads) {
    const words = `${ad.headline || ""} ${ad.body || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      phraseScores.set(phrase, (phraseScores.get(phrase) || 0) + Math.max(1, Math.floor((ad.heat || 60) / 20)));
    }
  }

  return [...phraseScores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([phrase, count], index) => ({
      id: `live-trend-${index + 1}`,
      name: titleCase(phrase),
      score: Math.min(98, 64 + count * 7),
      growth: `+${Math.min(55, 8 + count * 4)}%`,
      type: "Live creative phrase",
      category: "Transparency data",
      window: `${sinceDays}d`,
      recommendation: "优先验证到广告标题、短视频字幕和落地页首屏。"
    }));
}

function getHostname(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function titleCase(value) {
  return value
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

module.exports = {
  createIntelReport,
  getSourceStatus
};
