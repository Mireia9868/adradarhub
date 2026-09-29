# Ad Trend Radar

面向海外广告投放的竞品广告、趋势和素材自动迭代工作台。输入目标网站，例如 `garvee.com`，系统会返回 Meta、Google、Bing 三类广告透明度来源的广告素材、竞品域名、趋势信号和数据源状态；再导入广告平台效果数据后，平台会把客户层级素材要求自动继承到下一轮素材 Brief。

## Run

```bash
npm start
```

打开：

```text
http://localhost:4173
```

## Deploy to adradarhub.com

This project is configured for a Render Node Web Service with `render.yaml`.

1. Push this repository to GitHub.
2. Open Render and create a new Blueprint from `https://github.com/Mireia9868/adradarhub`.
3. Set the service environment variables in Render:
   - `META_ACCESS_TOKEN`
   - `GOOGLE_TRANSPARENCY_ENDPOINT`
   - `TRANSPARENCY_CONNECTOR_TOKEN`
4. After the Render service is live, add these custom domains in Render:
   - `adradarhub.com`
   - `www.adradarhub.com`
5. In your Wix Domains DNS panel, point the domain to the DNS records Render shows for those two custom domains.

For a Wix-purchased domain, open `https://manage.wix.com/account/domains`, select `adradarhub.com`, then manage DNS records:

- Add or update the root/apex `A` record for `@` to Render's IP address shown in Render.
- Add or update the `CNAME` record for `www` to the Render service hostname shown in Render, usually ending with `.onrender.com`.
- Remove conflicting `A`, `CNAME`, or `AAAA` records for `@` and `www` if Wix shows conflicts.
- Keep Wix as the registrar; you do not need to transfer the domain away from Wix.

The app exposes `/api/health` for Render health checks.

## Check API connections

填完 `.env` 后先跑：

```bash
npm run check:apis -- garvee.com
```

也可以只检查某个平台：

```bash
npm run check:apis -- --website=garvee.com --platforms=bing --markets=US
```

网站运行后可直接访问健康检查接口：

```text
http://127.0.0.1:4173/api/api-check?website=garvee.com&platforms=meta,google,bing&markets=US
```

## What works now

- 输入网站后调用 `/api/intel` 自动生成广告情报报告。
- 在“素材迭代”模块维护客户、品牌、市场、平台、活动层级素材要求，并自动合并为有效规则。
- 导入广告平台 CSV 后调用 `/api/iteration`，根据 CTR、CVR、CPA、ROAS、thumb-stop rate、hold rate 生成放量、重构和落地页承接建议。
- 自动输出下一轮素材 Brief，包含继承检查清单、执行动作、预期指标和可复制的创意生成提示词。
- 默认返回可演示数据，页面流程、筛选、竞品、趋势和来源状态都可直接使用。
- 后端已预留平台 connector，配置后可切换为真实数据或混合数据。

## Creative iteration CSV

“素材迭代”模块支持从广告平台导出 CSV 后直接粘贴或上传。推荐字段：

```csv
creative_id,platform,campaign,angle,hook,impressions,clicks,spend,conversions,revenue,thumb_stop_rate,hold_rate
meta-hook-001,Meta,US Patio Prospecting,Fast shipping promise,Ship your backyard upgrade this week,82000,1640,2460,82,10660,0.31,0.18
```

字段名也兼容部分中文表头，例如 `素材ID`、`平台`、`广告系列`、`展示量`、`点击量`、`花费`、`转化`、`收入`、`点击率`、`转化率`。

## Live connector contract

真实数据有三种接入方式：

- Meta：使用官方 Graph API / Ad Library API，需要 `META_ACCESS_TOKEN`。
- Microsoft/Bing：使用 Microsoft Advertising Ad Library 公开 API，默认启用。
- Google：Google Ads Transparency Center 目前没有公开 REST API，需要配置合规的内部采集 connector。
- 任一平台失败或未配置时，系统会保留 demo 兜底并在页面显示 warning。

复制 `.env.example` 并填入真实配置：

```bash
cp .env.example .env
```

当前仓库已经放了一个本地 `.env`，Microsoft/Bing 官方 API 默认启用；Meta 和 Google 需要补自己的授权或采集服务。

如果用 shell 直接启动，可以这样配置：

```bash
META_ACCESS_TOKEN=your_meta_token \
GOOGLE_TRANSPARENCY_ENDPOINT=https://your-connector.example.com/google \
npm start
```

也可以配置通用 connector：

```bash
META_TRANSPARENCY_ENDPOINT=https://your-connector.example.com/meta
BING_TRANSPARENCY_ENDPOINT=https://your-connector.example.com/bing
TRANSPARENCY_CONNECTOR_TOKEN=optional-shared-token
CONNECTOR_TIMEOUT_MS=15000
CONNECTOR_CURL_FALLBACK=true
```

通用 connector 接收：

每个 endpoint 接收：

```json
{
  "platform": "meta",
  "brand": "Garvee",
  "domain": "garvee.com",
  "markets": ["US", "GB", "CA", "AU"],
  "sinceDays": 30,
  "sourceUrl": "https://www.facebook.com/ads/library/"
}
```

返回：

```json
{
  "ads": [
    {
      "id": "ad_123",
      "advertiser": "Example",
      "headline": "Outdoor storage sale",
      "body": "Promo copy",
      "cta": "Shop Now",
      "format": "Video",
      "market": "US",
      "firstSeen": "2026-07-20",
      "heat": 88,
      "spendSignal": "Scaling",
      "landingUrl": "https://example.com",
      "sourceUrl": "https://adstransparency.google.com/",
      "imageUrl": "https://example.com/creative.jpg",
      "tags": ["Outdoor storage", "Labor Day"]
    }
  ],
  "trends": [],
  "competitors": [],
  "warnings": []
}
```

## Files

- `server.js` serves the static website and API routes.
- `src/intel.js` validates queries and assembles reports.
- `src/iteration.js` inherits creative requirements and turns platform metrics into iteration briefs.
- `src/connectors/transparency.js` calls live connector endpoints when configured.
- `src/siteAnalytics.js`, `src/connectors/gscConnector.js`, `src/connectors/ga4Connector.js` 提供 GSC + GA4 站点数据。
- `src/googleAuth.js` 用服务账号 JWT 换 access token（无第三方依赖）。
- `src/mockIntel.js` provides demo data for local use.
- `public/` contains the dashboard UI.

## 站点数据：GSC + GA4

「站点数据」模块把自然搜索（需求侧）和站内行为（供给侧）合并成一份能派工的报告。
广告侧看竞品投什么，这个模块看自己站点接不接得住。

### 接入步骤（约 15 分钟）

1. **建服务账号**：Google Cloud Console → IAM 和管理 → 服务账号 → 创建服务账号 → 密钥 → 添加密钥 → 创建新密钥（JSON）。
2. **开 API**：API 库里启用 `Google Search Console API` 与 `Google Analytics Data API`（analyticsdata.googleapis.com）。
3. **给权限**（漏这步会一直 403）：
   - GSC → 设置 → 用户和权限 → 添加用户，填服务账号邮箱，权限「受限用户」。
   - GA4 → 管理 → 媒体资源访问权限管理 → 添加用户，填同一个邮箱，角色「查看者」。
4. **填环境变量**（`.env` 本地 / Render 后台线上）：

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# 或整段 JSON：GOOGLE_SERVICE_ACCOUNT_JSON={"client_email":"...","private_key":"..."}
GSC_SITE_URL=sc-domain:adradarhub.com   # 也可写 https://adradarhub.com/
GA4_PROPERTY_ID=123456789
```

私钥里的换行在 `.env` 中写成字面量 `\n` 即可，代码会自动还原成真实换行。

5. **自检**：

```bash
npm run check:site                      # 用默认域名
npm run check:site -- adradarhub.com 28 # 指定域名与窗口
```

浏览器直接看：

```text
http://127.0.0.1:4173/api/site-analytics?website=adradarhub.com&sinceDays=28
```

### 拉什么数据

| 来源 | 维度 | 指标 |
| --- | --- | --- |
| GSC | query / page / country / device / date | clicks、impressions、CTR、position |
| GA4 | sessionDefaultChannelGroup / pagePath / country / date | activeUsers、sessions、screenPageViews、engagementRate、conversions |

### 自动产出的洞察

| 洞察 | 触发条件 | 动作 |
| --- | --- | --- |
| 高曝光低点击 | CTR 低于同排名行业正常值（内置 CTR 曲线） | 改 title / meta，同一批词进搜索广告 RSA 做 A/B |
| 临门一脚词 | 排名 4–15 位且曝光 ≥ 100 | 内容补强 + 搜索广告精确匹配抢前 3 |
| 点击环比下滑 | 后半窗口点击低于前半 15% 以上 | 查索引/robots，或对比 SERP 富摘要变化 |
| 渠道结构失衡 | 付费会话占比 ≥ 50% | 把付费高转化词反向补成内容页，压品牌词出价 |
| 低互动落地页 | 浏览量 ≥ 200 且互动率 < 40% | 重做首屏，进「素材迭代」做 A/B |
| 有流量没转化 | 会话 ≥ 100 且 CVR < 2% | 先核事件打点（key event），再拆渠道定位 |

未配置凭证时全部返回演示数据，页面照样跑通，且在「数据源」页明确显示 Demo。

### 站点自身的 GA4 与 GSC 验证（可选）

```bash
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GSC_VERIFICATION_CODE=从 GSC「HTML 标记」复制的 content 值
```

配了这两个变量后，`index.html` 的 `<!--SITE_TAGS-->` 位置会自动注入 gtag 代码片段与
`<meta name="google-site-verification">`，密钥不进仓库。没配则页面原样输出。
`robots.txt` 与 `sitemap.xml` 已在 `public/` 下，直接在 GSC 提交 sitemap 即可。

## Language / 语言

站点默认英文，右上角（侧边栏底部）有 EN / 中文 切换按钮，选择会写入 localStorage。

- 强制指定：`?lang=en` 或 `?lang=zh`（例如 `https://adradarhub.com/?lang=zh`）
- 改默认语言：`public/i18n.js` 里的 `ATR_DEFAULT_LANG = "en"` 改成 `"zh"`
- 覆盖范围分两层：
  - **前端**：`public/i18n.js` 的字典驱动，静态文案用 `data-i18n`，动态文案用 `t("key")`；
  - **后端**：`src/i18n.js` 的字典驱动，请求带 `lang` 参数即可，洞察 / Brief / 报错提示全按语言生成
    （`/api/intel`、`/api/iteration`、`/api/site-analytics`、`/api/source-status` 都支持）。
- 切换语言时会自动重跑「素材迭代」与「站点数据」（走不计配额的 GET 拉取），
  `/api/intel` 不重跑，避免每天 10 次配额被语言切换消耗。

## Official sources

- Meta Ad Library: https://www.facebook.com/ads/library/
- Meta Graph API reference: https://developers.facebook.com/docs/marketing-api/reference/ads_archive/
- Google Ads Transparency Center: https://adstransparency.google.com/
- Microsoft Advertising Ad Library: https://adlibrary.ads.microsoft.com/
- Microsoft Ad Library API docs: https://learn.microsoft.com/en-us/advertising/ad-library-api/
