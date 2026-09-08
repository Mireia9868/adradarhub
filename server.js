const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { loadEnv } = require("./src/env");
const { createIntelReport, getSourceStatus } = require("./src/intel");
const { checkApiConnections } = require("./src/apiHealth");
const { createIterationPlan } = require("./src/iteration");
const { generateImage } = require("./src/imageGen");
const { chatCompletion } = require("./src/deepseek");
const { handleGoogleConnector } = require("./src/connectors/googleConnector");
const { fetchVideoForBrief, buildBriefFallback } = require("./src/connectors/youtubeConnector");

loadEnv();

const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/source-status") {
      return sendJson(res, 200, getSourceStatus());
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "adtrendradar",
        generatedAt: new Date().toISOString()
      });
    }

    if (req.method === "GET" && url.pathname === "/api/api-check") {
      const checks = await checkApiConnections({
        website: url.searchParams.get("website") || "readdy.ai",
        markets: url.searchParams.get("markets") || "US",
        platforms: url.searchParams.get("platforms") || "meta,google,bing",
        sinceDays: Number(url.searchParams.get("sinceDays") || 30)
      });
      return sendJson(res, 200, checks);
    }

    if (req.method === "POST" && url.pathname === "/api/intel") {
      const body = await readJson(req);
      const report = await createIntelReport(body);
      return sendJson(res, 200, report);
    }

    if (req.method === "POST" && url.pathname === "/api/iteration") {
      const body = await readJson(req);
      const plan = createIterationPlan(body);
      return sendJson(res, 200, plan);
    }

    if (req.method === "POST" && url.pathname === "/api/generate-image") {
      const body = await readJson(req);
      try {
        const images = await generateImage({
          prompt: body.prompt,
          negativePrompt: body.negativePrompt,
          size: body.size,
          model: body.model,
          steps: body.steps
        });
        return sendJson(res, 200, { images });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, {
          error: err.message
        });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/llm") {
      const body = await readJson(req);
      try {
        const text = await chatCompletion({
          system: body.system,
          prompt: body.prompt,
          model: body.model,
          temperature: body.temperature,
          maxTokens: body.maxTokens
        });
        return sendJson(res, 200, { text });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, {
          error: err.message
        });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/youtube/brief") {
      const body = await readJson(req);
      try {
        const video = await fetchVideoForBrief(body.videoId);
        let brief;
        let engine = "template";
        if (process.env.DEEPSEEK_API_KEY) {
          const text = await chatCompletion({
            system:
              "你是资深海外广告投放操盘手，擅长把竞品视频情报转成可执行的广告素材 Brief。" +
              "输出简体中文，结构清晰，可直接交给素材与投放同学执行。只使用输入中给出的事实，不要编造数据。",
            prompt:
              `竞品视频情报如下（JSON）：\n${JSON.stringify(video, null, 2)}\n\n` +
              `我方品牌：${body.brand || "未指定"}。请输出一份投放素材 Brief，包含：\n` +
              "1. 视频情报速览（两句话：这条视频为什么值得跟）；\n" +
              "2. Hook 拆解（前 3 秒可能的抓人方式）；\n" +
              "3. 结构复刻脚本（0-5s / 5-20s / 20-45s / 结尾 CTA）；\n" +
              "4. 卖点映射：结构套用到我方品牌；\n" +
              "5. 投放标题 ×3；\n6. 缩略图方向 ×2；\n" +
              "7. 投放建议（剪辑规格与适配平台）。",
            temperature: 0.6,
            maxTokens: 1400
          });
          brief = text;
          engine = "deepseek";
        } else {
          brief = buildBriefFallback(video, body.brand);
        }
        return sendJson(res, 200, { video, brief, engine });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { error: err.message });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/google-connector") {
      const body = await readJson(req);
      try {
        const result = await handleGoogleConnector(body);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "method_not_allowed" });
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      return sendJson(res, 404, { error: "not_found" });
    }

    const file = await fs.readFile(filePath).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!file) {
      return sendJson(res, 404, { error: "not_found" });
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    res.end(file);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, {
      error: status === 500 ? "server_error" : error.message,
      message: error.message
    });
  }
});

server.listen(port, host, () => {
  console.log(`Ad Trend Radar running at http://${host}:${port}`);
});

function resolveStaticPath(pathname) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(normalized).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return null;
  return filePath;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let rawBody = "";
    req.on("data", chunk => {
      rawBody += chunk;
      if (rawBody.length > 1_000_000) {
        reject(Object.assign(new Error("payload_too_large"), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(Object.assign(new Error("invalid_json"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}
