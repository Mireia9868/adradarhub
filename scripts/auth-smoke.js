// 账号体系离线自测：用本地桩服务模拟 Supabase PostgREST，验证注册/登录/配额/日切逻辑。
// 运行：node scripts/auth-smoke.js
const http = require("node:http");
const crypto = require("node:crypto");

// —— 内存版 Supabase ——
const db = { users: [], events: [] };

function parseQuery(pathname) {
  const query = pathname.split("?")[1] || "";
  // PostgREST 过滤格式是 column=eq.value，这里模拟同语义
  return Object.fromEntries(
    Array.from(new URLSearchParams(query), ([k, v]) => [
      k,
      decodeURIComponent(v).replace(/^eq\./, "")
    ])
  );
}

const stub = http.createServer((req, res) => {
  let raw = "";
  req.on("data", c => (raw += c));
  req.on("end", () => {
    const path = req.url.split("?")[0];
    const query = parseQuery(req.url);

    if (path === "/rest/v1/atr_users" && req.method === "GET") {
      const found = db.users.filter(u => u.email === query["email"]);
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(found));
    }

    if (path === "/rest/v1/atr_users" && req.method === "POST") {
      const body = JSON.parse(raw || "{}");
      if (db.users.some(u => u.email === body.email)) {
        res.writeHead(409, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "duplicate key" }));
      }
      const user = {
        id: crypto.randomUUID(),
        email: body.email,
        password_hash: body.password_hash,
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify([user]));
    }

    if (path === "/rest/v1/atr_usage_events" && req.method === "POST") {
      const body = JSON.parse(raw || "{}");
      db.events.push({ ...body, id: db.events.length + 1 });
      res.writeHead(201, { "content-type": "application/json" });
      return res.end("{}");
    }

    if (path === "/rest/v1/atr_usage_events" && (req.method === "HEAD" || req.method === "GET")) {
      const count = db.events.filter(e => e.user_id === query["user_id"] && e.day === query["day"]).length;
      res.writeHead(200, { "content-type": "application/json", "content-range": `*/${count}` });
      return res.end(req.method === "HEAD" ? "" : "[]");
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "not found" }));
  });
});

const results = [];
function check(label, condition, detail = "") {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  await new Promise(resolve => stub.listen(0, "127.0.0.1", resolve));
  const port = stub.address().port;

  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.AUTH_SECRET = "test-secret-do-not-use-in-prod";
  process.env.DAILY_QUOTA = "10";
  process.env.QUOTA_UTC_OFFSET = "8";

  const auth = require("../src/auth");

  console.log("\n[1] 配置与降级行为");
  check("账号系统识别为已启用", auth.authConfig().enabled === true);

  process.env.AUTH_SECRET = "";
  check("缺 AUTH_SECRET 时自动降级为不启用", auth.authConfig().enabled === false,
    `missing=${auth.authConfig().missing.join(",")}`);
  process.env.AUTH_SECRET = "test-secret-do-not-use-in-prod";

  console.log("\n[2] 注册");
  const email = `tester${Date.now()}@example.com`;
  const created = await auth.signUp({ email, password: "strongpass123" });
  check("注册成功并返回 token", Boolean(created.token));
  check("返回剩余额度 10", created.usage.remaining === 10, `used=${created.usage.used}`);

  const dup = await auth.signUp({ email, password: "strongpass123" }).catch(e => e);
  check("重复邮箱注册被拒（409）", dup.statusCode === 409, dup.message);

  const weak = await auth.signUp({ email: "x@y.com", password: "123" }).catch(e => e);
  check("弱密码被拒（400）", weak.statusCode === 400, weak.message);

  const badEmail = await auth.signUp({ email: "not-an-email", password: "strongpass123" }).catch(e => e);
  check("非法邮箱被拒（400）", badEmail.statusCode === 400, badEmail.message);

  console.log("\n[3] 登录");
  const wrong = await auth.signIn({ email, password: "wrongpass" }).catch(e => e);
  check("错误密码被拒（401）", wrong.statusCode === 401, wrong.message);

  const unknown = await auth.signIn({ email: "nobody@example.com", password: "strongpass123" }).catch(e => e);
  check("账号不存在返回同一提示（防枚举）", unknown.statusCode === 401 && unknown.message === wrong.message);

  const login = await auth.signIn({ email, password: "strongpass123" });
  check("正确凭据登录成功", Boolean(login.token));
  check("登录返回已用配额", login.usage.used === 0, `used=${login.usage.used}`);

  const payload = auth._internal.readToken(login.token);
  check("token 可解析且含用户 id", payload && payload.sub === created.user.id);
  check("伪造签名被拒", auth._internal.readToken(login.token.slice(0, -3) + "xxx") === null);
  check("过期 token 被拒", (() => {
    const cfg = { secret: "test-secret-do-not-use-in-prod" };
    const expired = crypto.createHmac("sha256", cfg.secret)
      .update(Buffer.from(JSON.stringify({ sub: "x", exp: 1 })).toString("base64url"))
      .digest("base64url");
    return auth._internal.readToken(
      `${Buffer.from(JSON.stringify({ sub: "x", exp: 1 })).toString("base64url")}.${expired}`
    ) === null;
  })());

  console.log("\n[4] 每日配额（限 10 次）");
  const uid = created.user.id;
  for (let i = 1; i <= 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const usage = await auth.consume(uid, "intel");
    if (usage.remaining !== 10 - i) {
      check(`第 ${i} 次扣减后额度正确`, false, `remaining=${usage.remaining}`);
      break;
    }
  }
  check("连续 10 次后剩余 0", (await auth.readUsage(null, uid)).remaining === 0);

  const exhausted = await auth.consume(uid, "intel").catch(e => e);
  check("第 11 次被拒（429）", exhausted.statusCode === 429, exhausted.message);
  check("429 提示里带重置时间", /重置/.test(exhausted.message || ""));

  console.log("\n[5] 隔天自动恢复");
  const beforeOffset = process.env.QUOTA_UTC_OFFSET;
  process.env.QUOTA_UTC_OFFSET = "-16"; // 切到另一个自然日
  const nextDay = await auth.readUsage(null, uid);
  check("换日后额度重置为 10", nextDay.remaining === 10, `day=${nextDay.day}`);
  const okNextDay = await auth.consume(uid, "intel").catch(e => e);
  check("换日后可继续拉取", okNextDay && okNextDay.remaining === 9);
  process.env.QUOTA_UTC_OFFSET = beforeOffset;

  stub.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error("smoke test crashed:", error);
  stub.close();
  process.exitCode = 1;
});
