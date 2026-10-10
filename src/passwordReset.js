const crypto = require("node:crypto");
const { _internal, authConfig } = require("./auth");
const { getLang } = require("./i18n");
const { config, rest, findUserByEmail, validateCredentials, hashPassword } = _internal;
const buckets = new Map();
function error(statusCode, en, zh) {
  return Object.assign(new Error(getLang() === "zh" ? zh : en), { statusCode });
}
function recoveryEnabled() {
  return authConfig().enabled && Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}
function invalid() { return error(400, "Reset link is invalid, expired or already used. Request a new link.", "重置链接无效、已过期或已使用，请重新申请。"); }
function signature(body, user, cfg) {
  return crypto.createHmac("sha256", cfg.secret).update(`password-reset:${user.password_hash}:${body}`).digest("base64url");
}
function limit(key, maximum, windowMs) {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  const value = buckets.get(key) || { count: 0, until: now + windowMs };
  if (value.count >= maximum || buckets.size >= 10000 && !buckets.has(key)) {
    throw error(429, "Too many requests. Please try again later.", "请求过于频繁，请稍后再试。");
  }
  value.count += 1; buckets.set(key, value);
}
async function forgotPassword({ email }, address = "unknown") {
  if (!recoveryEnabled()) throw error(503, "Password reset email is not available yet. Please contact support.", "密码重置邮件暂未启用，请联系管理员。");
  const normalized = String(email || "").trim().toLowerCase();
  validateCredentials(normalized, "validation-only");
  limit(`ip:${address}`, 20, 3600000);
  limit(`email:${crypto.createHash("sha256").update(normalized).digest("hex")}`, 1, 60000);
  const cfg = config();
  const user = await findUserByEmail(cfg, normalized);
  const message = getLang() === "zh" ? "如果该邮箱已注册，我们会发送重置链接，请检查收件箱和垃圾邮件。" : "If this email is registered, a reset link will be sent. Check your inbox and spam folder.";
  if (user) {
    const body = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, exp: Date.now() + 30 * 60000, nonce: crypto.randomBytes(16).toString("hex"), purpose: "password-reset" })).toString("base64url");
    const token = `${body}.${signature(body, user, cfg)}`;
    const origin = new URL(process.env.AUTH_SITE_URL || "https://adradarhub.com");
    if (origin.protocol !== "https:") throw error(503, "Password reset is unavailable.", "密码重置暂不可用。");
    const url = `${origin.origin}/#reset-password=${encodeURIComponent(token)}`;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10000),
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": `reset-${crypto.createHash("sha256").update(token).digest("hex")}` },
        body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM, to: [user.email], subject: "Ad Radar Hub — Reset your password / 重置密码", text: `Reset your password / 重置密码：\n${url}\n\nThis link expires in 30 minutes and can be used once.\n链接 30 分钟内有效，仅可使用一次。\nIf you did not request this, ignore this email. 若非本人申请，请忽略。` })
      });
      if (!response.ok) throw new Error("delivery_failed");
    } catch {
      // Same public response for existing/unknown accounts, including delivery failure.
      console.error("Password reset email delivery failed; check Resend configuration.");
    }
  }
  return { message };
}
async function resetPassword({ token, password }) {
  const cfg = config();
  if (!cfg.enabled) throw error(503, "Password reset is unavailable.", "密码重置暂不可用。");
  if (typeof token !== "string" || token.length > 2048 || token.split(".").length !== 2) throw invalid();
  const [body, sig] = token.split(".");
  let payload;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { throw invalid(); }
  if (payload.purpose !== "password-reset" || !Number.isFinite(payload.exp) || payload.exp <= Date.now() || payload.exp > Date.now() + 30 * 60000 || typeof payload.email !== "string") throw invalid();
  const user = await findUserByEmail(cfg, payload.email);
  if (!user || user.id !== payload.sub) throw invalid();
  const want = Buffer.from(signature(body, user, cfg)); const given = Buffer.from(sig);
  if (want.length !== given.length || !crypto.timingSafeEqual(want, given)) throw invalid();
  validateCredentials(user.email, password);
  if (password.length > 256) throw error(400, "Password must not exceed 256 characters.", "密码不能超过 256 位。");
  const response = await rest(cfg, `atr_users?id=eq.${encodeURIComponent(user.id)}&password_hash=eq.${encodeURIComponent(user.password_hash)}&select=id`, {
    method: "PATCH", prefer: "return=representation", body: { password_hash: hashPassword(password) }
  });
  if ((await response.json()).length !== 1) throw invalid();
  return { message: getLang() === "zh" ? "密码已更新，请使用新密码登录。" : "Password updated. Please log in with your new password." };
}
module.exports = { forgotPassword, resetPassword, recoveryEnabled };
