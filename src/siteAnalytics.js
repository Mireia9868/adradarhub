// 站点数据聚合层：把 GSC（需求侧）+ GA4（供给侧）拼成一份能直接派活的报告。
// 设计原则同全站其他模块：只输出"能落地"的结论——每条洞察都带证据数字和具体动作，
// 拿不到真实数据时回退演示数据并明确标注，不把 demo 伪装成 live。
const { fetchGscData, getGscStatus, createGscDemo } = require("./connectors/gscConnector");
const { fetchGa4Data, getGa4Status, createGa4Demo } = require("./connectors/ga4Connector");

const DEFAULT_SINCE_DAYS = 28;

async function createSiteAnalyticsReport(input = {}) {
  const website = normalizeWebsite(input.website || input.domain || process.env.GSC_DEFAULT_DOMAIN || "");
  const sinceDays = clampInt(Number(input.sinceDays || process.env.SITE_ANALYTICS_SINCE_DAYS || DEFAULT_SINCE_DAYS), 3, 180);
  const siteUrl = input.siteUrl || process.env.GSC_SITE_URL || (website ? `sc-domain:${website}` : "");
  const propertyId = input.propertyId || process.env.GA4_PROPERTY_ID || "";

  const warnings = [];
  const [gsc, ga4] = await Promise.all([
    loadSource(getGscStatus(), () => fetchGscData({ siteUrl, sinceDays }), () =>
      createGscDemo({ website: siteUrl || website, sinceDays })
    ),
    loadSource(getGa4Status(), () => fetchGa4Data({ propertyId, sinceDays }), () =>
      createGa4Demo({ website, sinceDays })
    )
  ]);

  gsc.warnings.forEach(message => warnings.push({ source: "gsc", message }));
  ga4.warnings.forEach(message => warnings.push({ source: "ga4", message }));

  const usedLive = gsc.sourceMode === "live" || ga4.sourceMode === "live";

  return {
    generatedAt: new Date().toISOString(),
    query: {
      website: website || (siteUrl || "").replace(/^sc-domain:/, ""),
      siteUrl: gsc.siteUrl,
      propertyId: ga4.propertyId,
      sinceDays
    },
    sourceMode: gsc.sourceMode === "live" && ga4.sourceMode === "live" ? "live" : usedLive ? "mixed" : "demo",
    summary: buildSummary(gsc, ga4),
    gsc,
    ga4,
    insights: buildInsights(gsc, ga4),
    warnings
  };
}

async function loadSource(status, liveLoader, demoLoader) {
  if (!status.configured) return demoLoader();
  try {
    return await liveLoader();
  } catch (error) {
    // 已配置但取数失败（权限/配额/写错 ID）：回退演示数据，但把真实错误抛到页面，
    // 否则用户会以为"配置成功了但没数据"，排查成本极高。
    const demo = demoLoader();
    demo.warnings = [
      `已配置 ${status.label}，但 live 取数失败：${error.message}。当前显示演示数据。`
    ];
    return demo;
  }
}

function buildSummary(gsc, ga4) {
  const ctr = gsc.totals?.ctr || 0;
  const sessions = ga4.totals?.sessions || 0;
  const conversions = ga4.totals?.conversions || 0;

  return {
    clicks: gsc.totals?.clicks || 0,
    impressions: gsc.totals?.impressions || 0,
    ctr,
    position: gsc.totals?.position || 0,
    users: ga4.totals?.activeUsers || 0,
    sessions,
    engagementRate: ga4.totals?.engagementRate || 0,
    conversions,
    cvr: sessions ? conversions / sessions : 0,
    channelCount: (ga4.channels || []).length,
    queryCount: gsc.totals?.queryCount || (gsc.queries || []).length
  };
}

// 洞察编排：全部带证据行（哪个词 / 哪个页面 / 多少数字）+ 一条可派给具体同学的动作。
function buildInsights(gsc, ga4) {
  const insights = [];

  pushCtrGapInsight(insights, gsc);
  pushNearTopInsight(insights, gsc);
  pushTrendInsight(insights, gsc);
  pushChannelMixInsight(insights, ga4);
  pushLandingPageInsight(insights, ga4);
  pushConversionInsight(insights, ga4);

  const priorityRank = { P0: 0, P1: 1, P2: 2 };
  return insights.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

// 1. 有曝光没点击：排名已经在前 10，CTR 却明显低于该排名的正常值 → 标题/描述没写对。
function pushCtrGapInsight(insights, gsc) {
  const rows = (gsc.opportunities || []).filter(item => item.reasons.some(reason => reason.includes("CTR")));
  if (!rows.length) return;

  const top = rows.slice(0, 3);
  const lostClicks = Math.round(
    rows.reduce((sum, item) => sum + item.impressions * Math.max(item.expectedCtr - item.ctr, 0), 0)
  );

  insights.push({
    id: "gsc-ctr-gap",
    type: "ctr_gap",
    priority: lostClicks >= 200 ? "P0" : "P1",
    title: "高曝光低点击：标题/描述没接住需求",
    evidence: `${rows.length} 个词 CTR 低于同排名正常值，按行业 CTR 曲线估算每月少拿约 ${lostClicks} 次点击；代表词：${top
      .map(item => `${item.query}（曝光 ${item.impressions} / CTR ${(item.ctr * 100).toFixed(1)}% / 排名 ${item.position.toFixed(1)}）`)
      .join("；")}`,
    action: `改这 ${Math.min(rows.length, 5)} 个落地页的 title 与 meta description（把核心卖点前置到前 60 字符），同时把同一批词加进搜索广告 RSA 标题做 A/B。`,
    items: top.map(item => ({
      label: item.query,
      value: `${item.impressions} 曝光 · CTR ${(item.ctr * 100).toFixed(1)}% · 第 ${item.position.toFixed(1)} 位`
    }))
  });
}

// 2. 排名第 4~15 位：离首页前 3 只有一步，是内容加推和搜索广告加词性价比最高的区间。
function pushNearTopInsight(insights, gsc) {
  const rows = (gsc.queries || []).filter(
    item => item.position > 3 && item.position <= 15 && item.impressions >= 100
  );
  if (!rows.length) return;

  const sorted = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, 5);

  insights.push({
    id: "gsc-near-top",
    type: "near_top",
    priority: "P1",
    title: "临门一脚词：排名 4–15 位，冲前 3 收益最大",
    evidence: `${rows.length} 个词卡在第 4–15 位，合计曝光 ${sorted.reduce((sum, item) => sum + item.impressions, 0)}；代表词：${sorted
      .slice(0, 3)
      .map(item => `${item.query}（第 ${item.position.toFixed(1)} 位）`)
      .join("；")}`,
    action: "挑 3 个词做内容补强（加 FAQ 段落 + 内链指向主转化页），同时在搜索广告里开精确匹配抢前 3 位置，测 14 天看自然位是否同步上移。",
    items: sorted.map(item => ({
      label: item.query,
      value: `第 ${item.position.toFixed(1)} 位 · ${item.impressions} 曝光`
    }))
  });
}

// 3. 环比下滑：不看拐点只看总量，会错过排名掉光的早期信号。
function pushTrendInsight(insights, gsc) {
  const delta = gsc.delta;
  if (!delta) return;
  const half = delta.halfDays || 0;
  if (delta.clicks > -0.15) return;

  insights.push({
    id: "gsc-click-drop",
    type: "trend",
    priority: delta.clicks <= -0.3 ? "P0" : "P1",
    title: "自然点击环比下滑",
    evidence: `后 ${half} 天比前 ${half} 天点击下降 ${Math.abs(delta.clicks * 100).toFixed(1)}%，曝光变化 ${(delta.impressions * 100).toFixed(1)}%`,
    action:
      delta.impressions < -0.1
        ? "先查索引与 robots：GSC → 网页索引报告，确认页面没被 noindex 或抓取失败；再看是不是核心词排名被竞品挤掉。"
        : "曝光没掉但点击掉了，问题在 SERP 展现本身：检查竞品是否上了评分/FAQ 富摘要，并对比自己的 title 是否被打折重写。",
    items: []
  });
}

// 4. 渠道结构：付费占比过高说明自然承接没做起来，反过来说明还有加投放空间。
function pushChannelMixInsight(insights, ga4) {
  const channels = ga4.channels || [];
  if (!channels.length) return;

  const sessions = channels.reduce((sum, item) => sum + (item.sessions || 0), 0);
  if (!sessions) return;

  const paid = channels
    .filter(item => /paid|display|cpc/i.test(item.sessionDefaultChannelGroup || ""))
    .reduce((sum, item) => sum + (item.sessions || 0), 0);
  const organic = channels
    .filter(item => /organic/i.test(item.sessionDefaultChannelGroup || ""))
    .reduce((sum, item) => sum + (item.sessions || 0), 0);

  const paidShare = paid / sessions;
  const organicShare = organic / sessions;

  insights.push({
    id: "ga4-channel-mix",
    type: "channel_mix",
    priority: paidShare >= 0.5 ? "P1" : "P2",
    title: paidShare >= 0.5 ? "付费流量占比过半，自然承接偏弱" : "流量结构：判断还能不能加投放",
    evidence: `付费（Paid Search/Display）占会话 ${(paidShare * 100).toFixed(1)}%，自然搜索占 ${(organicShare * 100).toFixed(1)}%，总会话 ${sessions}`,
    action:
      paidShare >= 0.5
        ? "把付费跑出高转化的词反向补成内容页，目标是 30 天内自然占比提到 35% 以上；同时压低品牌词的付费出价，避免自己抢自己。"
        : `自然搜索仍是主力（${(organicShare * 100).toFixed(1)}%），可在转化最好的 3 个页面上加投付费，放大已验证的承接路径。`,
    items: channels.slice(0, 5).map(item => ({
      label: item.sessionDefaultChannelGroup,
      value: `${item.sessions} 会话 · 互动率 ${(item.engagementRate * 100).toFixed(1)}%`
    }))
  });
}

// 5. 落地页：高浏览低互动的页面，是广告预算漏得最快的地方。
function pushLandingPageInsight(insights, ga4) {
  const pages = ga4.pages || [];
  if (!pages.length) return;

  const weak = pages.filter(item => (item.screenPageViews || 0) >= 200 && (item.engagementRate || 0) < 0.4);
  if (!weak.length) return;

  const sorted = [...weak].sort((a, b) => a.engagementRate - b.engagementRate).slice(0, 4);

  insights.push({
    id: "ga4-weak-landing",
    type: "landing_page",
    priority: weak.length >= 3 ? "P0" : "P1",
    title: "高流量低互动页面：预算在这里漏",
    evidence: `${weak.length} 个页面浏览量 ≥ 200 但互动率低于 40%；最差：${sorted
      .slice(0, 3)
      .map(item => `${item.pagePath}（${item.screenPageViews} 浏览 / 互动率 ${(item.engagementRate * 100).toFixed(1)}%）`)
      .join("；")}`,
    action: "按「首屏 3 秒说清卖点 + 社会证明前置 + 表单/CTA 上移」三件事重做首屏，改完进「素材迭代」模块做一轮 A/B，两周后用同一批广告流量复测。",
    items: sorted.map(item => ({
      label: item.pagePath,
      value: `${item.screenPageViews} 浏览 · 互动率 ${(item.engagementRate * 100).toFixed(1)}%`
    }))
  });
}

// 6. 转化：会话有了但转化没跟上，说明承接链路或付费路径有问题。
function pushConversionInsight(insights, ga4) {
  const sessions = ga4.totals?.sessions || 0;
  const conversions = ga4.totals?.conversions || 0;
  if (sessions < 100) return;

  const cvr = conversions / sessions;
  if (cvr >= 0.02) return;

  insights.push({
    id: "ga4-low-cvr",
    type: "conversion",
    priority: "P0",
    title: "有流量没转化：转化路径断层",
    evidence: `${sessions} 会话只产生 ${conversions} 个转化（CVR ${(cvr * 100).toFixed(2)}%），互动率 ${((ga4.totals?.engagementRate || 0) * 100).toFixed(1)}%`,
    action: "先在 GA4 里核对关键事件是否正确打点（转化事件是否被标为 key event），再按渠道拆 CVR 定位是流量质量问题还是结账流程问题；在定位清楚前不要加预算。",
    items: []
  });
}

function normalizeWebsite(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
}

function clampInt(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(Math.round(number), min), max);
}

module.exports = {
  createSiteAnalyticsReport
};
