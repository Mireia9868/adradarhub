// Google Ads Transparency connector（方案A：自建 connector）
//
// 站点会把查询 POST 到 GOOGLE_TRANSPARENCY_ENDPOINT，本模块负责返回归一化广告数据。
// 契约（来自 src/connectors/transparency.js 的 fetchPlatformIntel）：
//   请求 body: { platform, brand, domain, markets:[...], sinceDays, sourceUrl }
//   响应:       { platform, sourceMode, warnings, ads:[...], trends, competitors }
//   ads 每项字段经 normalizeAds 归一化：id, advertiser, headline, body, cta, format,
//                       market, firstSeen, heat, spendSignal, landingUrl, sourceUrl, imageUrl, tags
//
// 重要：Google 没有官方广告透明度 API。真实数据源待用户决定：
//   - 分支1：第三方 Google 广告情报 API（用户提供服务商与 key）
//   - 分支2：合规抓取 Transparency Center（需评估 ToS，且易碎）
// 当前默认返回【清晰标注 SAMPLE】的样本数据，仅用于验证管道是否打通，绝不是真实竞品广告。

function sampleAds(query) {
  const domain = query.domain || query.brand || "example.com";
  const market = (Array.isArray(query.markets) && query.markets[0]) || "US";
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: "sample-google-1",
      platform: "google",
      advertiser: "[SAMPLE] 示例品牌 — 请接入真实数据源",
      headline: "示例广告标题（Sample）",
      body: "这是样本数据，仅用于验证 Google connector 管道是否打通。不是真实竞品广告。",
      cta: "Learn More",
      format: "Display",
      market,
      firstSeen: today,
      heat: 60,
      spendSignal: "Sample",
      landingUrl: `https://${domain}/`,
      sourceUrl: "https://adstransparency.google.com/",
      imageUrl: "",
      tags: ["Google Transparency", "sample"]
    }
  ];
}

// 真实数据源接入点（待用户决定后在此实现对应分支）
async function fetchGoogleAds(query) {
  // 分支1：第三方 Google 广告情报 API
  // if (process.env.GOOGLE_DATA_API_KEY) {
  //   return await fetchFromThirdParty(query, process.env.GOOGLE_DATA_API_KEY);
  // }
  // 分支2：合规抓取 Transparency Center
  // if (process.env.GOOGLE_SCRAPER_MODE === "on") {
  //   return await scrapeTransparencyCenter(query);
  // }
  // 默认：返回样本数据（明确标注，避免被误认为真实数据）
  return sampleAds(query);
}

async function handleGoogleConnector(body = {}) {
  const query = {
    platform: body.platform || "google",
    brand: body.brand || "",
    domain: body.domain || "",
    markets: Array.isArray(body.markets) ? body.markets : body.markets ? [body.markets] : ["US"],
    sinceDays: Number(body.sinceDays || 30)
  };

  try {
    const ads = await fetchGoogleAds(query);
    return {
      platform: "google",
      sourceMode: "live",
      warnings: [
        "Google connector 运行在 SAMPLE 模式：返回的是样本数据，不是真实竞品广告。接入真实数据源后此提示会消失。"
      ],
      ads,
      trends: [],
      competitors: []
    };
  } catch (err) {
    return {
      platform: "google",
      sourceMode: "demo",
      warnings: [`Google connector 调用失败: ${err.message}`],
      ads: [],
      trends: [],
      competitors: []
    };
  }
}

module.exports = { handleGoogleConnector };
