// Google 服务端鉴权：GSC（Search Console API）与 GA4（Analytics Data API）都只认
// OAuth2 access token，服务端没人能点授权页，所以走服务账号 JWT 或刷新令牌两条路。
// 这里不引第三方依赖，用 node:crypto 直接签 RS256 JWT，避免给 Render 加安装步骤。
//
// 模式一（推荐）：服务账号
//   GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//   或整段 JSON：GOOGLE_SERVICE_ACCOUNT_JSON={"client_email":"...","private_key":"..."}
//   或文件路径：GOOGLE_SERVICE_ACCOUNT_FILE=/etc/secrets/gsa.json
//   把服务账号邮箱加进 GSC 媒体资源用户、GA4 媒体资源「查看者」即可，无需 OAuth 同意屏。
//
// 模式二：刷新令牌（个人账号授权一次后长期可用）
//   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN
const crypto = require("node:crypto");
const fs = require("node:fs");

const TOKEN_URL = "https://oauth2.googleapis.com/token";

// 同一进程内按 scope 缓存 token，避免每次查询都去换票（GSC + GA4 一次拉取会打 5~8 个请求）。
const tokenCache = new Map();

const SCOPES = {
  gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
  ga4: ["https://www.googleapis.com/auth/analytics.readonly"]
};

function serviceAccount() {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      return pickServiceAccount(parsed);
    } catch (error) {
      throw new Error(`google_service_account_file_unreadable:${error.message}`);
    }
  }

  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      return pickServiceAccount(JSON.parse(rawJson));
    } catch (error) {
      throw new Error(`google_service_account_json_invalid:${error.message}`);
    }
  }

  return pickServiceAccount({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  });
}

function pickServiceAccount(parsed) {
  const email = parsed && parsed.client_email;
  // .env 里单引号包裹时换行常被写成字面量 \n，必须还原成真换行，否则 openssl 签名失败。
  const privateKey = normalizePrivateKey(parsed && parsed.private_key);
  if (!email || !privateKey) return null;
  return { email, privateKey };
}

function normalizePrivateKey(value) {
  if (!value) return "";
  const text = String(value);
  return text.includes("\\n") ? text.replace(/\\n/g, "\n") : text;
}

function refreshTokenConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

function authMode() {
  if (serviceAccount()) return "service-account";
  if (refreshTokenConfig()) return "refresh-token";
  return "none";
}

// 取 access token。scopeKey 传 "gsc" 或 "ga4"（见 SCOPES）。
async function getAccessToken(scopeKey) {
  const scopes = SCOPES[scopeKey];
  if (!scopes) throw new Error(`google_unknown_scope:${scopeKey}`);

  const cacheKey = scopeKey;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const account = serviceAccount();
  const body = account
    ? new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signServiceAccountJwt(account, scopes)
      })
    : buildRefreshTokenBody(scopes);

  if (!body) {
    throw new Error(
      "google_auth_missing: 未配置 Google 鉴权。可用 GOOGLE_SERVICE_ACCOUNT_EMAIL + " +
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY（或 GOOGLE_SERVICE_ACCOUNT_JSON），" +
        "也可用 GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN。"
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000))
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.error_description || payload.error || "";
    throw new Error(`google_token_failed:${response.status}:${detail}`);
  }
  if (!payload.access_token) {
    throw new Error("google_token_failed:响应里没有 access_token");
  }

  tokenCache.set(cacheKey, {
    token: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000
  });
  return payload.access_token;
}

function buildRefreshTokenBody(scopes) {
  const config = refreshTokenConfig();
  if (!config) return null;
  return new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    scope: scopes.join(" ")
  });
}

function signServiceAccountJwt(account, scopes) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.email,
    scope: scopes.join(" "),
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600
  };

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(claim));

  let signature;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${body}`);
    signer.end();
    signature = signer.sign(account.privateKey).toString("base64url");
  } catch (error) {
    throw new Error(
      `google_private_key_invalid:${error.message}（私钥需含 BEGIN/END PRIVATE KEY 行，换行用真实 \n）`
    );
  }

  return `${header}.${body}.${signature}`;
}

function base64url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

module.exports = {
  getAccessToken,
  authMode,
  serviceAccount,
  SCOPES
};
