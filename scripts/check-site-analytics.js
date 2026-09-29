#!/usr/bin/env node
// 站点数据自检：确认 GSC / GA4 能不能取到 live 数据。
// 用法：
//   npm run check:site                        # 用默认域名
//   npm run check:site -- adradarhub.com 28   # 指定域名与窗口
//   node scripts/check-site-analytics.js --list-sites   # 列出服务账号能访问的 GSC 媒体资源
const { loadEnv } = require("../src/env");
const { createSiteAnalyticsReport } = require("../src/siteAnalytics");
const { getGscStatus } = require("../src/connectors/gscConnector");
const { getGa4Status } = require("../src/connectors/ga4Connector");
const { authMode } = require("../src/googleAuth");

loadEnv();

const args = process.argv.slice(2);
const positional = args.filter(arg => !arg.startsWith("--"));
const website = positional[0] || process.env.GSC_DEFAULT_DOMAIN || "adradarhub.com";
const sinceDays = Number(positional[1] || 28);

async function main() {
  console.log(`Google 鉴权模式: ${authMode()}`);
  console.log(`GSC: ${statusLine(getGscStatus())}`);
  console.log(`GA4: ${statusLine(getGa4Status())}`);

  if (args.includes("--list-sites")) {
    const { listGscSites } = require("../src/connectors/gscConnector");
    const sites = await listGscSites();
    console.log("\n服务账号可访问的 GSC 媒体资源：");
    sites.forEach(site => console.log(`  - ${site.siteUrl} (${site.permissionLevel})`));
    if (!sites.length) console.log("  （空：服务账号还没被加进任何媒体资源的用户列表）");
    return;
  }

  const report = await createSiteAnalyticsReport({ website, sinceDays });

  console.log(`\n站点数据报告: ${report.query.website} | ${report.query.sinceDays} 天 | mode=${report.sourceMode}`);
  console.log(`GSC ${report.gsc.siteUrl} ${report.gsc.range.startDate} ~ ${report.gsc.range.endDate} (${report.gsc.sourceMode})`);
  console.log(
    `  点击 ${report.gsc.totals.clicks} / 曝光 ${report.gsc.totals.impressions} / CTR ${(report.gsc.totals.ctr * 100).toFixed(2)}% / 平均排名 ${report.gsc.totals.position.toFixed(1)}`
  );
  console.log(`GA4 property ${report.ga4.propertyId} (${report.ga4.sourceMode})`);
  console.log(
    `  用户 ${report.ga4.totals.activeUsers} / 会话 ${report.ga4.totals.sessions} / 互动率 ${(report.ga4.totals.engagementRate * 100).toFixed(1)}% / 转化 ${report.ga4.totals.conversions}`
  );

  console.log(`\n洞察 ${report.insights.length} 条：`);
  report.insights.forEach(insight => {
    console.log(`  [${insight.priority}] ${insight.title}`);
    console.log(`      证据：${insight.evidence}`);
    console.log(`      动作：${insight.action}`);
  });

  if (report.warnings.length) {
    console.log("\n告警：");
    report.warnings.forEach(item => console.log(`  ${item.source}: ${item.message}`));
  }
}

function statusLine(status) {
  return `${status.configured ? "configured" : "NOT configured"} (${status.mode}) ${status.detail}`;
}

main().catch(error => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
