// 端到端验证：桩 Supabase + 真实 server.js，验证登录拦截与配额扣减在 HTTP 层生效。
// 运行：node scripts/auth-e2e.js
const http = require("node:http");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const db = { users: [], events: [] };

const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", c => (raw += c));
  req.on("end", () => {
    const [path, search] = req.url.split("?");
    const query = Object.fromEntries(
      Array.from(new URLSearchParams(search || ""), ([k, v]) => [k, decodeURIComponent(v).replace(/^eq\./, "")])
    );

    if (path === "/rest/v1/atr_users" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(db.users.filter(u => u.email === query.email)));
    }
    if (path === "/rest/v1/atr_users" && req.method === "POST") {
      const body = JSON.parse(raw || "{}");
      if (db.users.some(u => u.email === body.email)) {
        res.writeHead(409, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "duplicate" }));
      }
      const user = { id: crypto.randomUUID(), email: body.email, password_hash: body.password_hash, created_at: new Date().toISOString() };
      db.users.push(user);
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify([user]));
    }
    if (path === "/rest/v1/atr_usage_events" && req.method === "POST") {
      db.events.push(JSON.parse(raw || "{}"));
      res.writeHead(201, { "content-type": "application/json" });
      return res.end("{}");
    }
    if (path === "/rest/v1/atr_usage_events") {
      const count = db.events.filter(e => e.user_id === query.user_id && e.day === query.day).length;
      res.writeHead(200, { "content-type": "application/json", "content-range": `*/${count}` });
      return res.end(req.method === "HEAD" ? "" : "[]");
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
});

const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function api(pathname, options = {}, token = "") {
  const response = await fetch(`http://127.0.0.1:${process.env.E2E_PORT}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

// platforms 传一个不存在的平台，避免 e2e 真的去打外部 API
const intelBody = JSON.stringify({ website: "readdy.ai", markets: ["US"], sinceDays: 30, platforms: ["none"] });

async function main() {
  await new Promise(r => stub.listen(0, "127.0.0.1", r));
  const stubPort = stub.address().port;

  const appPort = 4400 + Math.floor(Math.random() * 300);
  process.env.E2E_PORT = String(appPort);

  const child = spawn(process.execPath, ["server.js"], {
    cwd: `${__dirname}/..`,
    env: {
      ...process.env,
      PORT: String(appPort),
      YOUTUBE_API_KEY: "",
      SUPABASE_URL: `http://127.0.0.1:${stubPort}`,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      AUTH_SECRET: "e2e-secret",
      DAILY_QUOTA: "10",
      QUOTA_UTC_OFFSET: "8"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise(r => child.stdout.once("data", r));

  console.log("\n[1] 配置接口");
  const cfg = await api("/api/auth/config");
  check("返回 enabled=true 与 quotaPerDay=10", cfg.body.enabled === true && cfg.body.quotaPerDay === 10,
    `missing=${(cfg.body.missing || []).join(",")}`);

  console.log("\n[2] 未登录拦截");
  const anon = await api("/api/intel", { method: "POST", body: intelBody });
  check("未登录调用拉取接口被拒（401）", anon.status === 401, anon.body.message || anon.body.error);
  const badToken = await api("/api/intel", { method: "POST", body: intelBody }, "forged.token.value");
  check("伪造 token 被拒（401）", badToken.status === 401);

  console.log("\n[3] 注册并拉取");
  const email = `e2e${Date.now()}@example.com`;
  const signup = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password: "strongpass123" }) });
  check("注册成功返回 token", signup.status === 200 && Boolean(signup.body.token));
  const token = signup.body.token;

  const me = await api("/api/auth/me", {}, token);
  check("/api/auth/me 返回用户与配额", me.body.user?.email === email && me.body.usage?.remaining === 10);

  const first = await api("/api/intel", { method: "POST", body: intelBody }, token);
  check("已登录可正常拉取（200）", first.status === 200, `ads=${(first.body.ads || []).length}`);
  check("响应带回剩余额度头 x-quota-remaining=9", first.headers.get("x-quota-remaining") === "9",
    `got=${first.headers.get("x-quota-remaining")}`);

  console.log("\n[4] 每日 10 次上限");
  let lastStatus = 0;
  let lastBody = {};
  for (let i = 0; i < 9; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api("/api/intel", { method: "POST", body: intelBody }, token);
    lastStatus = res.status;
    lastBody = res.body;
    if (res.status !== 200) break;
  }
  check("第 10 次仍成功", lastStatus === 200, `status=${lastStatus}`);

  const eleventh = await api("/api/intel", { method: "POST", body: intelBody }, token);
  check("第 11 次返回 429", eleventh.status === 429, eleventh.body.message || eleventh.body.error);

  const meExhausted = await api("/api/auth/me", {}, token);
  check("配额接口显示剩余 0", meExhausted.body.usage?.remaining === 0);

  console.log("\n[5] 换日自动恢复");
  child.kill();
  const child2 = spawn(process.execPath, ["server.js"], {
    cwd: `${__dirname}/..`,
    env: {
      ...process.env,
      PORT: String(appPort),
      YOUTUBE_API_KEY: "",
      SUPABASE_URL: `http://127.0.0.1:${stubPort}`,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      AUTH_SECRET: "e2e-secret",
      DAILY_QUOTA: "10",
      QUOTA_UTC_OFFSET: "-16"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise(r => child2.stdout.once("data", r));
  const nextDay = await api("/api/intel", { method: "POST", body: intelBody }, token);
  check("换日后可继续拉取", nextDay.status === 200, `remaining=${nextDay.headers.get("x-quota-remaining")}`);

  child2.kill();
  stub.close();

  const failed = results.filter(r => !r).length;
  console.log(`\n结果：${results.length - failed}/${results.length} 通过`);
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  console.error("e2e crashed:", error);
  stub.close();
  process.exitCode = 1;
});
