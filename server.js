const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { loadEnv } = require("./src/env");
const { createIntelReport, getSourceStatus } = require("./src/intel");
const { checkApiConnections } = require("./src/apiHealth");
const { createIterationPlan } = require("./src/iteration");
const { generateImage } = require("./src/qwenImage");

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
        website: url.searchParams.get("website") || "garvee.com",
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
          model: body.model
        });
        return sendJson(res, 200, { images });
      } catch (err) {
        return sendJson(res, err.statusCode || 500, {
          error: err.message
        });
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
