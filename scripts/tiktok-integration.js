// TikTok 端到端集成自检：
// 起一个桩 TikHub（按真实路径返回 App V3 结构）+ 真实 server.js，
// 验证整条链路：HTTP 请求 → 解析 → 品牌过滤 → 打分 → 卡片/趋势/创作者 → API 路由 → Brief。
//   node scripts/tiktok-integration.js
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const STUB_PORT = 4701;
const APP_PORT = 4702;
const nowSec = Math.floor(Date.now() / 1000);
const day = 86400;

let failures = 0;
function check(label, condition, extra = "") {
  if (!condition) failures += 1;
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${label}${extra ? ` — ${extra}` : ""}`);
}

function aweme(id, handle, desc, plays, likes, ageDays, extras = {}) {
  return {
    aweme_id: id,
    desc,
    create_time: nowSec - Math.floor(ageDays * day),
    author: { unique_id: handle, nickname: handle, follower_count: 88000 + plays, avatar_thumb: { url_list: [`https://p16.example/${id}.jpg`] } },
    statistics: {
      play_count: plays,
      digg_count: likes,
      comment_count: Math.round(likes / 18),
      share_count: Math.round(likes / 25),
      collect_count: Math.round(likes / 12)
    },
    video: { duration: 27000, cover: { url_list: [`https://p16.example/cover-${id}.jpg`] } },
    music: { title: "original sound", author: handle },
    ...extras
  };
}

const VIDEO_MAP = {
  "7400000000000000009": aweme("7400000000000000009", "readdy_official", "Build your site with AI · readdy #readdy #aibuilder", 1860000, 174000, 5),
  "7400000000000000010": aweme("7400000000000000010", "readdy_official", "Landing page in minutes readdy #readdy #landingpage", 402000, 31000, 3),
  "7400000000000000011": aweme("7400000000000000011", "framer_hq", "readdy vs framer, honest take #readdy #framer", 2980000, 231000, 8),
  "7400000000000000012": aweme("7400000000000000012", "randy_music", "Best hip hop mix 2026 #music #rap", 91000000, 2100000, 40)
};

function startStub() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const auth = req.headers.authorization || "";

      if (auth !== "Bearer test-key-123") {
        res.writeHead(401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ code: 401, message: "Unauthorized", message_zh: "API token 无效" }));
      }

      res.writeHead(200, { "content-type": "application/json" });
      if (url.pathname === "/api/v1/tiktok/app/v3/fetch_video_search_result") {
        return res.end(JSON.stringify({
          code: 200,
          message: "Request successful.",
          data: {
            data: Object.values(VIDEO_MAP).map(item => ({ type: 1, item: { aweme_info: item } })),
            cursor: 20,
            has_more: 1
          }
        }));
      }
      if (url.pathname === "/api/v1/tiktok/app/v3/fetch_one_video") {
        const id = url.searchParams.get("aweme_id");
        const item = VIDEO_MAP[id];
        return res.end(JSON.stringify({ code: 200, data: { aweme_info: item || null } }));
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: 404, message: "not found" }));
    });
    server.listen(STUB_PORT, "127.0.0.1", () => resolve(server));
  });
}

function startApp() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        HOST: "127.0.0.1",
        NODE_ENV: "development",
        TIKTOK_API_KEY: "test-key-123",
        TIKTOK_PROVIDER: "tikhub",
        TIKTOK_API_BASE_URL: `http://127.0.0.1:${STUB_PORT}`,
        TIKTOK_SEARCH_LIMIT: "20",
        TIKTOK_REGION: "US",
        YOUTUBE_API_KEY: "",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        AUTH_SECRET: "",
        DEEPSEEK_API_KEY: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stderr.on("data", chunk => process.stderr.write(`[app] ${chunk}`));
    const timer = setTimeout(() => reject(new Error("app_start_timeout")), 15000);
    child.stdout.on("data", chunk => {
      if (String(chunk).includes("running at")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
  });
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${APP_PORT}/api/health`);
      if (response.ok) return true;
    } catch {
      /* keep polling */
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}

(async () => {
  console.log("TikTok 端到端集成自检");
  const stub = await startStub();
  const app = await startApp();
  const healthy = await waitForHealth();

  try {
    console.log("\n== 1. 服务起来 & 数据源状态 ==");
    check("健康检查通过", healthy);
    const statusResponse = await fetch(`http://127.0.0.1:${APP_PORT}/api/source-status`);
    const status = await statusResponse.json();
    check("tiktok 出现在 source-status", Boolean(status.tiktok));
    check("配了 Key → live-ready", status.tiktok?.mode === "live-ready", status.tiktok?.mode);
    check("provider 标注为 tikhub", status.tiktok?.provider === "tikhub", status.tiktok?.provider);

    console.log("\n== 2. /api/intel 拉取 TikTok 情报 ==");
    const intelResponse = await fetch(`http://127.0.0.1:${APP_PORT}/api/intel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        website: "readdy.ai",
        markets: ["US"],
        platforms: ["tiktok"],
        sinceDays: 30
      })
    });
    const report = await intelResponse.json();
    const tiktokAds = (report.ads || []).filter(ad => ad.platform === "tiktok");
    check("HTTP 200", intelResponse.status === 200, String(intelResponse.status));
    check("sourceMode 转为 mixed/live", ["mixed", "live"].includes(report.sourceMode), report.sourceMode);
    // 12 条随机音乐视频必须被品牌过滤掉，只剩 3 条含 readdy 的
    check("品牌过滤后剩 3 张卡", tiktokAds.length === 3, `实际 ${tiktokAds.length}`);
    check("无 demo 卡混入", !(report.ads || []).some(ad => String(ad.id).includes("demo")));
    check(
      "TikTok 卡排在 YouTube 之后",
      (report.ads || [])[0]?.platform === "tiktok"
    );
    const top = tiktokAds[0];
    check("卡片带 videoId", Boolean(top?.videoId));
    check("卡片 sourceUrl 指向 tiktok.com", String(top?.sourceUrl).includes("tiktok.com"), top?.sourceUrl);
    check("spendSignal 含播放与互动率", String(top?.spendSignal).includes("plays"), top?.spendSignal);
    console.log(`        榜首：${top?.advertiser} · heat ${top?.heat} · ${top?.spendSignal}`);

    console.log("\n== 3. 趋势标签 & 创作者聚合 ==");
    const tiktokTrends = (report.trends || []).filter(trend => String(trend.id).startsWith("tiktok-trend"));
    check("产出话题趋势", tiktokTrends.length > 0, `${tiktokTrends.length} 条`);
    check("趋势是 # 标签形式", tiktokTrends.every(trend => trend.name.startsWith("#")));
    console.log(`        Top3：${tiktokTrends.slice(0, 3).map(trend => `${trend.name}(${trend.score})`).join(" · ")}`);
    const tiktokCompetitors = (report.competitors || []).filter(item => String(item.domain).startsWith("tiktok.com/@"));
    check("产出创作者竞品卡", tiktokCompetitors.length > 0, `${tiktokCompetitors.length} 个`);
    console.log(`        Top2：${tiktokCompetitors.slice(0, 2).map(item => `${item.name}(${item.overlap})`).join(" · ")}`);

    console.log("\n== 4. /api/tiktok/brief 生成投放 Brief ==");
    const briefResponse = await fetch(`http://127.0.0.1:${APP_PORT}/api/tiktok/brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoId: "7400000000000000009", brand: "Readdy" })
    });
    const brief = await briefResponse.json();
    check("HTTP 200", briefResponse.status === 200, String(briefResponse.status));
    check("返回 video 元数据", brief.video?.videoId === "7400000000000000009");
    check("未配 DeepSeek → 模板兜底", brief.engine === "template", brief.engine);
    check("Brief 内容非空", Boolean(brief.brief && brief.brief.length > 200), `${brief.brief?.length} 字`);
    check("Brief 带竖版规格建议", String(brief.brief).includes("9:16"));

    console.log("\n== 5. 异常分支：视频不存在 → 404 ==");
    const missingResponse = await fetch(`http://127.0.0.1:${APP_PORT}/api/tiktok/brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoId: "not-exist-id", brand: "Readdy" })
    });
    check("返回 404 video_not_found", missingResponse.status === 404, String(missingResponse.status));
  } catch (error) {
    failures += 1;
    console.log(`  [FAIL] 执行异常：${error.message}`);
  } finally {
    app.kill();
    stub.close();
  }

  console.log(`\n结果：${failures === 0 ? "全部通过" : `${failures} 项失败`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
