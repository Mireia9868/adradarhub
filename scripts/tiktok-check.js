// TikTok connector 自检。
//   node scripts/tiktok-check.js              → 用内置 fixture 验证解析 / 打分 / 品牌过滤 / 趋势聚合
//   node scripts/tiktok-check.js --live       → 打真实接口，打印原始顶层结构便于校准解析器
//   node scripts/tiktok-check.js --live --dump → 额外落盘原始响应到 /tmp/tiktok-raw.json
// 需要先在 .env 里配好 TIKTOK_API_KEY（跑 fixture 模式不需要）。
const fs = require("node:fs");
const path = require("node:path");
require("../src/env").loadEnv();

const {
  collectAwemes,
  scoreVideoRows,
  fetchTikTokIntel,
  getTikTokStatus
} = require("../src/connectors/tiktokConnector");

const nowSec = Math.floor(Date.now() / 1000);
const day = 86400;

// 构造三种 TikHub 常见层级，验证 collectAwemes 的防御性遍历都能抽干净
function buildFixture() {
  const makeAweme = (id, uniqueId, desc, plays, likes, ageDays, extra = {}) => ({
    aweme_id: id,
    desc,
    create_time: nowSec - Math.floor(ageDays * day),
    author: {
      unique_id: uniqueId,
      nickname: uniqueId.toUpperCase(),
      follower_count: 120000 + plays,
      avatar_thumb: { url_list: [`https://p16.example/${id}.jpeg`] }
    },
    statistics: {
      play_count: plays,
      digg_count: likes,
      comment_count: Math.round(likes / 20),
      share_count: Math.round(likes / 30),
      collect_count: Math.round(likes / 15)
    },
    video: {
      duration: 21000,
      cover: { url_list: [`https://p16.example/cover-${id}.jpeg`] }
    },
    music: { title: "original sound", author: uniqueId },
    ...extra
  });

  return {
    // 层级 A：data.business_data[] → data.aweme_info（Web / 搜索系列常见）
    business_data: [
      { type: 1, data: { aweme_info: makeAweme("7400000000000000001", "readdy_official", "Build your site with AI #readdy #aibuilder #nocode", 920000, 88000, 6) } },
      { type: 1, data: { aweme_info: makeAweme("7400000000000000002", "readdy_official", "Landing page in minutes · readdy tutorial #readdy #landingpage", 310000, 21000, 4) } },
      { type: 1, data: { aweme_info: makeAweme("7400000000000000003", "wix", "Website builder comparison #wix #websitebuilder", 5400000, 210000, 12) } }
    ],
    // 层级 B：data.data[] → aweme_info（App V3 常见）
    data: [
      { aweme_info: makeAweme("7400000000000000004", "squarespace", "readdy vs squarespace honest review #readdy #squarespace", 1280000, 96000, 3) },
      { aweme_info: makeAweme("7400000000000000005", "design_tips", "5 layout tricks designers swear by #design #uxtips", 7600000, 410000, 20) }
    ],
    // 层级 C：data.aweme_list[] 裸对象
    aweme_list: [
      makeAweme("7400000000000000006", "readdy_hq", "We shipped custom domains today readdy #readdy #product", 64000, 7200, 1.5)
    ],
    cursor: 20,
    has_more: 1
  };
}

let failures = 0;
function check(label, condition, extra = "") {
  const status = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  console.log(`  [${status}] ${label}${extra ? ` — ${extra}` : ""}`);
}

function runFixtureChecks() {
  console.log("\n== 1. 解析器：三种响应层级抽取 ==");
  const fixture = buildFixture();
  const awemes = collectAwemes(fixture);
  check("抽到全部 6 条 aweme", awemes.length === 6, `实际 ${awemes.length}`);
  check(
    "层级 A/B/C 都有覆盖",
    ["7400000000000000001", "7400000000000000004", "7400000000000000006"].every(id =>
      awemes.some(item => item.aweme_id === id)
    )
  );

  console.log("\n== 2. 打分：Heat / 潜力 / 建议动作 ==");
  const rows = scoreVideoRows(awemes);
  check("条数一致", rows.length === 6);
  check("Heat 落在 0-100", rows.every(row => row.heat >= 0 && row.heat <= 100));
  check("结果按 Heat 降序", rows.every((row, i) => i === 0 || rows[i - 1].heat >= row.heat));
  check("互动率已算出", rows.every(row => Number.isFinite(row.engagementRate)));
  check("每条都有建议动作", rows.every(row => typeof row.action === "string" && row.action.length > 0));
  const top = rows[0];
  console.log(`        榜首：@${top.authorName} heat=${top.heat} plays=${top.views} 互动率=${top.engagementRate}% → ${top.action}`);

  console.log("\n== 3. 品牌过滤：剔掉不含品牌词的噪音 ==");
  const brandRows = rows.filter(row => {
    const hay = `${row.description} ${row.authorId} ${row.authorName} ${row.hashtags.join(" ")}`.toLowerCase();
    return hay.includes("readdy");
  });
  check("含 readdy 的内容被保留", brandRows.length === 4, `实际 ${brandRows.length}`);
  check(
    "纯无关内容（design_tips/design/#uxtips）不被保留",
    !brandRows.some(row => row.authorId === "design_tips")
  );
  // wix 那条文案没提 readdy，应被过滤
  check("同行提到品牌但文案无关的噪点也被过滤", !brandRows.some(row => row.authorId === "wix"));

  console.log("\n== 4. 字段提取：hashtag / 封面 / 时长 / 粉丝 ==");
  const first = rows.find(row => row.videoId === "7400000000000000001");
  check("话题标签抽出来了", first.hashtags.includes("readdy") && first.hashtags.includes("nocode"), first.hashtags.join(", "));
  check("封面 URL 拿到", first.cover.startsWith("https://"), first.cover);
  check("时长换算成秒", first.durationSeconds === 21, String(first.durationSeconds));
  check("粉丝数读到", first.followers > 0, String(first.followers));
  check("视频链接可拼", `https://www.tiktok.com/@${first.authorId}/video/${first.videoId}`);

  console.log("\n== 5. 状态位：未配 Key 时应为 demo ==");
  const saved = process.env.TIKTOK_API_KEY;
  delete process.env.TIKTOK_API_KEY;
  const status = getTikTokStatus();
  delete process.env.TIKTOK_API_KEY;
  if (saved) process.env.TIKTOK_API_KEY = saved;
  check("未配置 → mode=demo", status.mode === "demo" && status.configured === false, status.mode);
  check("missing 提示正确", status.missing.includes("TIKTOK_API_KEY"));
}

async function runLiveChecks() {
  const args = process.argv.slice(2);
  const keyword = process.env.TIKTOK_CHECK_KEYWORD || "readdy";
  console.log(`\n== 真实接口自检 · keyword="${keyword}" ==`);
  console.log(`   数据源：${process.env.TIKTOK_PROVIDER || "tikhub"} @ ${process.env.TIKTOK_API_BASE_URL || "https://api.tikhub.io"}`);

  const report = await fetchTikTokIntel({
    brand: keyword,
    website: new URL(`https://${keyword}.ai`),
    markets: ["US"],
    sinceDays: 30
  });

  console.log("   sourceMode:", report.sourceMode);
  console.log("   warnings:", report.warnings.length ? report.warnings : "无");
  console.log("   ads:", report.ads.length, "| trends:", report.trends.length, "| competitors:", report.competitors.length);

  if (!report.ads.length) {
    console.log("\n   没有卡片。可能原因：Key 无效/余额不足、该词确实无结果，或响应层级与预期不符。");
    return;
  }

  console.log("\n   前 3 张卡片：");
  report.ads.slice(0, 3).forEach(ad => {
    console.log(`   - [heat ${ad.heat}] ${ad.advertiser} ${ad.format} | ${ad.spendSignal}`);
    console.log(`     ${ad.headline.slice(0, 70)}`);
    console.log(`     ${ad.sourceUrl}`);
  });
  if (report.trends.length) {
    console.log("\n   趋势标签 Top 5：");
    report.trends.slice(0, 5).forEach(trend => {
      console.log(`   - ${trend.name} score=${trend.score} ${trend.growth} (${trend.window})`);
    });
  }
  if (report.competitors.length) {
    console.log("\n   创作者聚合 Top 3：");
    report.competitors.slice(0, 3).forEach(item => {
      console.log(`   - ${item.name} overlap=${item.overlap} | ${item.signal}`);
    });
  }

  if (args.includes("--dump")) {
    const target = path.join("/tmp", "tiktok-raw.json");
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
    console.log(`\n   原始报告已落盘：${target}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  console.log("TikTok connector 自检");
  runFixtureChecks();

  if (args.includes("--live")) {
    if (!process.env.TIKTOK_API_KEY) {
      console.log("\n[跳过] 未配置 TIKTOK_API_KEY，无法打真实接口。");
      console.log("      到 https://user.tikhub.io 注册取 Key，写进 .env 后重跑：node scripts/tiktok-check.js --live");
      console.log(`\n结果：${failures === 0 ? "fixture 全通过" : `${failures} 项失败`}`);
      process.exit(failures === 0 ? 0 : 1);
    }
    try {
      await runLiveChecks();
    } catch (error) {
      console.log(`\n真实接口调用失败：${error.message}`);
      process.exitCode = 1;
    }
  }

  console.log(`\n结果：${failures === 0 ? "全部通过" : `${failures} 项失败`}`);
  if (failures > 0) process.exitCode = 1;
})();
