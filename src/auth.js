// 极简账号体系：邮箱 + 密码注册登录，登录后按自然日计配额（默认每天 10 次数据拉取）。
// 存储走 Supabase（Postgres + PostgREST），只用 REST，不引第三方 SDK。
// 密码：Node 内置 scrypt 加盐哈希；会话：crypto HMAC 自签名 token，服务端无状态。
const crypto = require("node:crypto");

// —— 配置读取（放在函数里读，避免 require 时机早于 loadEnv）——
function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secret = process.env.AUTH_SECRET || "";
  const quotaPerDay = Math.max(1, Number(process.env.DAILY_QUOTA || 10));
  const utcOffset = Number(process.env.QUOTA_UTC_OFFSET || 8); // 默认按 Asia/Shanghai 切日
  return { url, key, secret, quotaPerDay, utcOffset, enabled: Boolean(url && key && secret) };
}

function authConfig() {
  const cfg = config();
  return { enabled: cfg.enabled, quotaPerDay: cfg.quotaPerDay, missing: missingKeys(cfg) };
}

function missingKeys(cfg) {
  const missing = [];
  if (!cfg.url) missing.push("SUPABASE_URL");
  if (!cfg.key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!cfg.secret) missing.push("AUTH_SECRET");
  return missing;
}

function httpError(statusCode, message, extra = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

// —— 自然日切分：按 utcOffset 小时偏移后的日期作为"今天" ——
function currentDay(cfg) {
  return new Date(Date.now() + cfg.utcOffset * 3600_000).toISOString().slice(0, 10);
}

function nextResetAt(cfg) {
  const now = Date.now() + cfg.utcOffset * 3600_000;
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0); // 次日 00:00（偏移时区）
  return new Date(next.getTime() - cfg.utcOffset * 3600_000).toISOString();
}

// —— 密码哈希：scrypt + 随机盐，格式 salt:hash ——
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// —— 会话 token：base64url(payload).hmac ——
function signToken(user, cfg) {
  const payload = {
    sub: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 86400 // 30 天
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", cfg.secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readToken(token) {
  const cfg = config();
  if (!cfg.enabled) return null;
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", cfg.secret).update(body).digest("base64url");
  const given = Buffer.from(sig || "", "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearerToken(req) {
  const raw = req.headers.authorization || "";
  return raw.startsWith("Bearer ") ? raw.slice(7) : "";
}

// —— Supabase REST ——
async function rest(cfg, pathname, options = {}) {
  const response = await fetch(`${cfg.url}/rest/v1/${pathname}`, {
    method: options.method || "GET",
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw httpError(502, `supabase_request_failed:${response.status}:${text.slice(0, 160)}`);
  }
  return response;
}

async function findUserByEmail(cfg, email) {
  const response = await rest(
    cfg,
    `atr_users?email=eq.${encodeURIComponent(email)}&select=id,email,password_hash,created_at&limit=1`
  );
  const rows = await response.json();
  return rows[0] || null;
}

function publicUser(row) {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

// —— 对外：注册 / 登录 ——
async function signUp({ email, password }) {
  const cfg = config();
  if (!cfg.enabled) throw httpError(503, "账号系统未配置：缺少 " + missingKeys(cfg).join(", "));
  const normalizedEmail = String(email || "").trim().toLowerCase();
  validateCredentials(normalizedEmail, password);

  const existing = await findUserByEmail(cfg, normalizedEmail);
  if (existing) throw httpError(409, "该邮箱已注册，请直接登录。");

  const response = await rest(cfg, "atr_users", {
    method: "POST",
    prefer: "return=representation",
    body: { email: normalizedEmail, password_hash: hashPassword(password) }
  });
  const rows = await response.json();
  const user = rows[0];
  if (!user) throw httpError(502, "注册失败：Supabase 未返回用户记录。");
  return issueSession(user, cfg);
}

async function signIn({ email, password }) {
  const cfg = config();
  if (!cfg.enabled) throw httpError(503, "账号系统未配置：缺少 " + missingKeys(cfg).join(", "));
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) throw httpError(400, "请填写邮箱和密码。");

  const user = await findUserByEmail(cfg, normalizedEmail);
  // 邮箱不存在与密码错误返回同一提示，避免账号枚举
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw httpError(401, "邮箱或密码不正确。");
  }
  return issueSession(user, cfg);
}

async function issueSession(user, cfg) {
  const usage = await readUsage(cfg, user.id);
  return { token: signToken(user, cfg), user: publicUser(user), usage };
}

function validateCredentials(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpError(400, "请填写有效的邮箱地址。");
  if (typeof password !== "string" || password.length < 8) {
    throw httpError(400, "密码至少 8 位。");
  }
}

// —— 配额：usage_events 追加写 + count 读取，天然避免并发改同一行 ——
async function readUsage(cfg, userId) {
  const cfgNow = cfg || config();
  const day = currentDay(cfgNow);
  const used = await countEvents(cfgNow, userId, day);
  return {
    day,
    used,
    limit: cfgNow.quotaPerDay,
    remaining: Math.max(0, cfgNow.quotaPerDay - used),
    resetAt: nextResetAt(cfgNow)
  };
}

async function countEvents(cfg, userId, day) {
  const response = await rest(
    cfg,
    `atr_usage_events?user_id=eq.${userId}&day=eq.${day}&select=id`,
    { method: "HEAD", prefer: "count=exact" }
  );
  const range = response.headers.get("content-range") || "";
  // 形如 "0-9/10" 或 "*/10"
  const total = range.split("/")[1];
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function consume(userId, action = "intel") {
  const cfg = config();
  if (!cfg.enabled) return null;
  const usage = await readUsage(cfg, userId);
  if (usage.used >= cfg.quotaPerDay) {
    throw Object.assign(
      httpError(429, `今日 ${usage.limit} 次额度已用完，额度将在 ${usage.resetAt} 重置。`),
      { usage }
    );
  }
  await rest(cfg, "atr_usage_events", {
    method: "POST",
    body: { user_id: userId, day: usage.day, action }
  });
  return { ...usage, used: usage.used + 1, remaining: usage.limit - usage.used - 1 };
}

// —— 中间件：读取 Authorization，返回用户 + 配额，未启用时返回 null ——
async function resolveSession(req) {
  const cfg = config();
  if (!cfg.enabled) return null;
  const payload = readToken(bearerToken(req));
  if (!payload) throw httpError(401, "请先登录后再拉取数据。");
  const usage = await readUsage(cfg, payload.sub);
  return { user: { id: payload.sub, email: payload.email }, usage };
}

// 需要配额的接口统一走这里：先校验会话，再扣一次额度
async function requireQuota(req, action) {
  const session = await resolveSession(req);
  if (!session) return null; // 账号系统未启用，放行
  const usage = await consume(session.user.id, action);
  return { ...session, usage };
}

function quotaHeaders(usage) {
  return usage
    ? {
        "x-quota-limit": String(usage.limit),
        "x-quota-used": String(usage.used),
        "x-quota-remaining": String(usage.remaining)
      }
    : {};
}

module.exports = {
  authConfig,
  signUp,
  signIn,
  resolveSession,
  requireQuota,
  readUsage,
  consume,
  quotaHeaders,
  // 仅用于离线自测
  _internal: { hashPassword, verifyPassword, signToken, readToken, currentDay, config }
};
