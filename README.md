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
- `src/mockIntel.js` provides demo data for local use.
- `public/` contains the dashboard UI.

## Official sources

- Meta Ad Library: https://www.facebook.com/ads/library/
- Meta Graph API reference: https://developers.facebook.com/docs/marketing-api/reference/ads_archive/
- Google Ads Transparency Center: https://adstransparency.google.com/
- Microsoft Advertising Ad Library: https://adlibrary.ads.microsoft.com/
- Microsoft Ad Library API docs: https://learn.microsoft.com/en-us/advertising/ad-library-api/
