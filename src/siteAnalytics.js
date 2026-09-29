// 站点数据聚合层：把 GSC（需求侧）+ GA4（供给侧）拼成一份能直接派活的报告。
// 设计原则同全站其他模块：只输出"能落地"的结论——每条洞察都带证据数字和具体动作，
// 拿不到真实数据时回退演示数据并明确标注，不把 demo 伪装成 live。
const { fetchGscData, getGscStatus, createGscDemo } = require("./connectors/gscConnector");
const { fetchGa4Data, getGa4Status, createGa4Demo } = require("./connectors/ga4Connector");
const { tr } = require("./i18n");

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
      tr("site.loadSourceWarning", { label: status.label, msg: error.message })
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
    title: tr("site.insight.ctrGap.title"),
    evidence: tr("site.insight.ctrGap.evidence", {
      n: rows.length,
      lost: lostClicks,
      list: top
        .map(item =>
          tr("site.insight.ctrGap.detail", {
            q: item.query,
            i: item.impressions,
            c: (item.ctr * 100).toFixed(1),
            p: item.position.toFixed(1)
          })
        )
        .join(tr("site.insight.ctrGap.join"))
    }),
    action: tr("site.insight.ctrGap.action", { n: Math.min(rows.length, 5) }),
    items: top.map(item => ({
      label: item.query,
      value: tr("site.insight.ctrGap.item", {
        i: item.impressions,
        c: (item.ctr * 100).toFixed(1),
        p: item.position.toFixed(1)
      })
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
    title: tr("site.insight.nearTop.title"),
    evidence: tr("site.insight.nearTop.evidence", {
      n: rows.length,
      imp: sorted.reduce((sum, item) => sum + item.impressions, 0),
      list: sorted
        .slice(0, 3)
        .map(item => tr("site.insight.nearTop.detail", { q: item.query, p: item.position.toFixed(1) }))
        .join(tr("site.insight.ctrGap.join"))
    }),
    action: tr("site.insight.nearTop.action"),
    items: sorted.map(item => ({
      label: item.query,
      value: tr("site.insight.nearTop.item", { p: item.position.toFixed(1), i: item.impressions })
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
    title: tr("site.insight.trend.title"),
    evidence: tr("site.insight.trend.evidence", {
      h: half,
      c: Math.abs(delta.clicks * 100).toFixed(1),
      i: (delta.impressions * 100).toFixed(1)
    }),
    action:
      delta.impressions < -0.1 ? tr("site.insight.trend.actionIndex") : tr("site.insight.trend.actionSerp"),
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
    title: paidShare >= 0.5 ? tr("site.insight.channel.titlePaid") : tr("site.insight.channel.titleMix"),
    evidence: tr("site.insight.channel.evidence", {
      p: (paidShare * 100).toFixed(1),
      o: (organicShare * 100).toFixed(1),
      s: sessions
    }),
    action: paidShare >= 0.5
      ? tr("site.insight.channel.actionPaid")
      : tr("site.insight.channel.actionOrganic", { o: (organicShare * 100).toFixed(1) }),
    items: channels.slice(0, 5).map(item => ({
      label: item.sessionDefaultChannelGroup,
      value: tr("site.insight.channel.item", {
        s: item.sessions,
        e: (item.engagementRate * 100).toFixed(1)
      })
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
    title: tr("site.insight.landing.title"),
    evidence: tr("site.insight.landing.evidence", {
      n: weak.length,
      list: sorted
        .slice(0, 3)
        .map(item =>
          tr("site.insight.landing.detail", {
            path: item.pagePath,
            v: item.screenPageViews,
            e: (item.engagementRate * 100).toFixed(1)
          })
        )
        .join(tr("site.insight.ctrGap.join"))
    }),
    action: tr("site.insight.landing.action"),
    items: sorted.map(item => ({
      label: item.pagePath,
      value: tr("site.insight.landing.item", {
        v: item.screenPageViews,
        e: (item.engagementRate * 100).toFixed(1)
      })
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
    title: tr("site.insight.cvr.title"),
    evidence: tr("site.insight.cvr.evidence", {
      s: sessions,
      c: conversions,
      r: (cvr * 100).toFixed(2),
      e: ((ga4.totals?.engagementRate || 0) * 100).toFixed(1)
    }),
    action: tr("site.insight.cvr.action"),
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
