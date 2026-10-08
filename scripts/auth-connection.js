// Read-only deployment check. Run in the environment containing the server secrets.
const { loadEnv } = require("../src/env");
const { authConfig } = require("../src/auth");

async function main() {
  loadEnv();
  const config = authConfig();
  if (!config.enabled) throw new Error(`缺少服务端变量：${config.missing.join(", ")}`);
  const url = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const table of ["atr_users", "atr_usage_events"]) {
    const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=0`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`${table} 连接失败（HTTP ${response.status}），请检查项目、密钥和 schema.sql。`);
    console.log(`PASS ${table} 可访问`);
  }
  console.log("数据库连接通过；请继续在网页验证注册、退出、登录和刷新后的会话恢复。");
}

main().catch(error => {
  console.error(error.name === "TimeoutError" ? "Supabase 连接超时。" : error.message);
  process.exitCode = 1;
});
