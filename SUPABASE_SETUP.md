# 注册登录 + 每日配额接入说明

登录后可每天拉取 10 次数据（配额可调）。账号与用量存 Supabase Postgres，
后端只用 Node 内置能力（scrypt 密码哈希 + HMAC 签名会话），**没有引入任何第三方依赖**。

---

## 一、Supabase 侧（一次性，约 3 分钟）

1. 打开 https://supabase.com/ 注册并新建项目（免费套餐足够，Region 建议选 **Southeast Asia (Singapore)**，和 Render 服务同区）。
2. 进入 **SQL Editor** → New query，把 `supabase/schema.sql` 整段粘贴 → **Run**。
   会创建两张表：`atr_users`（账号）、`atr_usage_events`（用量流水），并启用 RLS、禁止浏览器角色访问。已有表也请重新运行此脚本以补齐权限保护。
3. 进入 **Project Settings → API**，复制两个值：
   - `Project URL` → 作为 `SUPABASE_URL`
   - `service_role` key（标注 "secret" 的那个）→ 作为 `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ service_role key 会绕过所有权限校验，**只能放服务端环境变量**，绝不能写进前端或提交到仓库。

---

## 二、Render 侧环境变量

Dashboard → `adradarhub` 服务 → **Environment**，添加：

| 变量 | 值 | 说明 |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | 上一步复制的 Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | service_role key |
| `AUTH_SECRET` | 随机长字符串 | 会话签名密钥，见下方生成方式 |
| `DAILY_QUOTA` | `10` | 可选，默认 10 |
| `QUOTA_UTC_OFFSET` | `8` | 可选，默认 8（按北京时间每日 0 点重置） |

生成 `AUTH_SECRET`（本机终端执行，复制输出）：

```bash
openssl rand -hex 32
```

保存后 Render 会自动重新部署一次。

> 未配置这三个变量时，系统会自动降级为"不校验模式"，站点照常可用，不会崩；
> 配好之后才出现登录入口并开始计配额。

---

## 三、行为规则

| 接口 | 是否需要登录 | 是否消耗配额 |
|---|---|---|
| `POST /api/intel` | ✅ | ✅ 每次 1 |
| `POST /api/llm` | ✅ | ✅ 每次 1 |
| `POST /api/generate-image` | ✅ | ✅ 每次 1 |
| `POST /api/youtube/brief` | ✅ | ✅ 每次 1 |
| `POST /api/iteration` | ❌ | ❌（纯本地计算） |
| `GET /api/source-status` | ❌ | ❌ |

- 配额按自然日重置，响应头会回传 `x-quota-remaining`，前端右上角实时显示剩余次数。
- 超出额度返回 `429` 并提示重置时间；未登录返回 `401`，前端自动弹出登录框。

---

## 四、接口约定

```
GET  /api/auth/config        → { enabled, quotaPerDay, missing }
POST /api/auth/signup        body { email, password }  → { token, user, usage }
POST /api/auth/login         body { email, password }  → { token, user, usage }
GET  /api/auth/me            header Authorization: Bearer <token> → { user, usage }
```

前端把 token 存在 `localStorage.atr_token`，每次请求带 `Authorization` 头。


## 五、部署验收与排错

这是 **Supabase Postgres 存储 + 应用自己的账号体系**，不是 Supabase Auth。
注册账号在 Table Editor 的 `atr_users` 查看，不会出现在 Authentication → Users。
不要把这套应用账号和 Supabase Auth 账号混用。

1. 在 Render 服务 Environment 中配置以上三个必填变量，再重新部署。
2. 打开 `/api/auth/config`，应返回 `enabled: true`、`missing: []`。
3. 在服务端执行 `npm run check:auth:connection`，确认密钥和两张表可读取。
4. 在网页注册一个测试邮箱，确认出现账号及剩余额度；退出后用同一邮箱密码登录。
5. 刷新网页，确认登录状态保留；错误密码应提示登录失败。
6. 在 Supabase Table Editor 中确认用户记录只有 `password_hash`，没有明文密码。

`enabled: true` 只说明环境变量齐全；数据库连接检查和网页实测都通过才算完成上线验收。
如果返回 `missing`，按变量名补齐部署环境；数据库请求失败时检查项目是否暂停、密钥是否正确、是否执行了 SQL 脚本。
连接检查只读取数据，不创建测试账号，也不输出密钥或密码哈希。
