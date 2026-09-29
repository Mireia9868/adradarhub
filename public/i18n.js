/* Ad Trend Radar — 前端双语字典（默认英文，可切中文）
 * 用法：
 *   静态文案：<span data-i18n="nav.overview">Overview</span>
 *   属性文案：data-i18n-placeholder / data-i18n-value / data-i18n-title / data-i18n-aria
 *   动态文案：t("ads.empty")
 *   变量：t("quota.remaining", { n: 3 })  -> "3 pulls left"
 */
const ATR_DICT = {
  en: {
    "brand.tagline": "Overseas ads intelligence",
    "lang.en": "EN",
    "lang.zh": "中文",

    "nav.overview": "Overview",
    "nav.ads": "Ad library",
    "nav.trends": "Trends",
    "nav.iteration": "Creative iteration",
    "nav.generate": "Creative studio",
    "nav.site": "Site data",
    "nav.sources": "Data sources",

    "mode.demo": "Demo mode",
    "mode.live": "Live mixed",
    "mode.idle": "Awaiting query",
    "mode.ready": "Connector ready",

    "hero.title": "Overseas Ad Creative Iteration Platform",
    "hero.desc":
      "Enter a brand domain to aggregate ad transparency sources. Import platform performance data and account-level creative requirements cascade into every iteration brief.",

    "auth.quota": "{n} pulls left",
    "auth.quotaInit": "10 pulls left",
    "auth.quotaEmpty": "Daily quota used up",
    "auth.logout": "Log out",
    "auth.open": "Log in / Sign up",
    "auth.loginRequired": "Please log in or create an account — 10 data pulls per day after login.",
    "auth.needLogin": "Please log in first.",
    "auth.titleLogin": "Log in to continue",
    "auth.titleSignup": "Create account",
    "auth.subLogin": "Log in for daily pull quota (resets every day).",
    "auth.subSignup": "Free signup includes a daily quota. Password must be at least 8 characters.",
    "auth.submitLogin": "Log in",
    "auth.submitSignup": "Sign up",
    "auth.submitLoginLoading": "Logging in…",
    "auth.submitSignupLoading": "Signing up…",
    "auth.loginFailed": "Something went wrong, please retry.",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.passwordHint": "At least 8 characters",
    "auth.close": "Close",

    "query.website": "Target website",
    "query.window": "Time window",
    "query.window.30": "Last 30 days",
    "query.window.60": "Last 60 days",
    "query.window.90": "Last 90 days",
    "query.market": "Market",
    "query.run": "Run scan",
    "query.running": "Scanning",
    "query.runError": "Scan failed: {msg}",
    "query.scanning": "Pulling ad transparency data and generating competitor trend signals.",
    "query.done": "{domain} analysed — {n} ad creatives returned.",

    "status.ready": "Ready",
    "status.readyDesc": "Enter a domain to start scanning ad transparency centers and trend signals.",
    "status.error": "Error",
    "status.loginRequired": "Login required",

    "metric.ads": "Ad creatives",
    "metric.adsHint": "Matched via transparency sources",
    "metric.hot": "High-heat creatives",
    "metric.competitors": "Competitor domains",
    "metric.competitorsHint": "Overlap in placements",
    "metric.trends": "Trend signals",
    "metric.trendsHint": "Awaiting analysis",
    "metric.backlog": "Iteration tasks",
    "metric.backlogHint": "Awaiting rule inheritance",
    "metric.rules": "{n} inherited rules",

    "panel.competitors": "Competitor radar",
    "panel.competitorsDesc": "Candidates for the next round of keyword and creative teardown.",
    "panel.ads": "Top ads",
    "panel.adsDesc": "Ranked by heat score, placement signals and trend keywords.",
    "panel.trends": "Trend opportunities",
    "panel.trendsDesc": "Turn hot keywords into ad angles and landing page priorities.",
    "panel.iteration": "Creative iteration hub",
    "panel.iterationDesc":
      "Account rules cascade down, platform data feeds back up — the next creative brief is generated automatically.",
    "panel.sample": "Fill sample data",
    "panel.rules": "Inherited creative requirements",
    "panel.rulesDesc": "Merged result across account, brand, market, platform and campaign levels.",
    "panel.signals": "Data feedback signals",
    "panel.signalsDesc": "Use CTR, CVR, CPA and ROAS to decide scale-up or rebuild.",
    "panel.summary": "Platform data summary",
    "panel.summaryDesc": "Falls back to demo data when the import is empty.",
    "panel.brief": "Next-round creative brief",
    "panel.briefDesc": "Turns performance data and inherited rules into tasks production, media and landing pages can run.",

    "iter.globalRules": "Account baseline requirements",
    "iter.globalRulesValue": "Brand name\nCore product\nClear CTA\nAvoid absolute superlatives\nOffer must match landing page",
    "iter.channelRules": "Market / platform requirements",
    "iter.channelRulesValue":
      "Local currency or local benefits\nMeta: core selling point in first 3 seconds\nGoogle: headlines cover high-intent keywords\nKeep one no-discount control per angle",
    "iter.csv": "Platform performance CSV",
    "iter.csvFile": "Import CSV file",
    "iter.run": "Generate iteration",
    "iter.running": "Generating",
    "iter.failed": "Could not generate iteration: {msg}",
    "iter.chain": "Inheritance chain",
    "iter.required": "Required elements",
    "iter.banned": "Banned claims",
    "iter.visual": "Visual rules",
    "iter.offer": "Offer rules",
    "iter.ruleCount": "{n} rules",

    "sum.mode": "Data mode",
    "sum.modeImported": "CSV imported",
    "sum.modeDemo": "Demo data",
    "sum.rows": "Creative rows",
    "sum.spend": "Total spend",
    "sum.conversions": "Total conversions",
    "sum.roas": "Overall ROAS",
    "sum.best": "Best creative",
    "sum.ctr": "Avg CTR",
    "sum.cvr": "Avg CVR",
    "sum.cpa": "Avg CPA",

    "brief.actions": "Execution actions",
    "brief.checklist": "Inheritance check",
    "brief.prompt": "Generated prompt",

    "gen.title": "Creative studio · Qwen text-to-image",
    "gen.desc":
      "Enter a creative prompt to generate ad images with the Qwen image model (keys stay server-side, never exposed to the browser).",
    "gen.helper": "DeepSeek prompt / copywriter",
    "gen.helperDesc":
      "Enter a rough idea and DeepSeek expands it into a polished image prompt plus ad copy (text only, no image credits), then hand it to Qwen in one click.",
    "gen.helperBadge": "Text generated by DeepSeek",
    "gen.idea": "Rough idea / core selling point",
    "gen.ideaPlaceholder": "e.g. outdoor rattan storage basket, small-balcony storage, warm natural style, sun-resistant",
    "gen.platform": "Target platform",
    "gen.platformMeta": "Meta (feed / short video)",
    "gen.platformGoogle": "Google (search / display)",
    "gen.platformBing": "Bing",
    "gen.ratio": "Aspect ratio",
    "gen.ratio169": "16:9 landscape",
    "gen.ratio43": "4:3",
    "gen.ratio11": "1:1 square",
    "gen.ratio34": "3:4",
    "gen.ratio916": "9:16 vertical",
    "gen.dsRun": "DeepSeek prompt + copy",
    "gen.dsRunning": "Generating…",
    "gen.dsWaiting": "DeepSeek is writing the prompt and copy, about 5–20 seconds…",
    "gen.dsEmpty": "Enter a rough idea or core selling point first.",
    "gen.dsResult": "DeepSeek output",
    "gen.dsUse": "Use this prompt →",
    "gen.dsFailed": "Generation failed: {msg}",
    "gen.prompt": "Prompt",
    "gen.promptPlaceholder":
      "e.g. photorealistic outdoor home ad, warm tones, sunlight on the patio, product centered, generous whitespace, fit for Meta feed",
    "gen.negative": "Negative prompt (optional)",
    "gen.negativePlaceholder": "e.g. text, watermark, distortion, low quality",
    "gen.run": "Generate creative",
    "gen.running": "Generating…",
    "gen.statusRunning": "Qwen is generating, about 10–40 seconds",
    "gen.statusWaiting": "Generating, please wait…",
    "gen.statusDone": "Done — {n} images generated",
    "gen.statusFailed": "Generation failed",
    "gen.emptyPrompt": "Enter a prompt first.",
    "gen.needPrompt": "Enter a prompt before generating.",
    "gen.openOriginal": "Open original",
    "gen.failed": "Generation failed: {msg}",

    "site.title": "Site data · GSC + GA4",
    "site.desc":
      "Organic demand side (impressions / clicks / ranking) merged with on-site supply side (channels / landing pages / conversions) into actions you can hand off.",
    "site.website": "Site domain",
    "site.gscUrl": "GSC property siteUrl",
    "site.gscUrlPlaceholder": "Leave empty to use server GSC_SITE_URL, e.g. sc-domain:adradarhub.com",
    "site.ga4Id": "GA4 property ID",
    "site.ga4IdPlaceholder": "Leave empty to use server GA4_PROPERTY_ID, digits only",
    "site.window": "Time window",
    "site.window.7": "Last 7 days",
    "site.window.28": "Last 28 days",
    "site.window.56": "Last 56 days",
    "site.window.90": "Last 90 days",
    "site.run": "Pull site data",
    "site.running": "Pulling…",
    "site.pulling": "Pulling GSC and GA4 data…",
    "site.note":
      "Returns demo data when no Google service account is configured — the flow and field definitions are still fully demoable.",
    "site.demoNote":
      "Currently showing demo data. Configure GOOGLE_SERVICE_ACCOUNT_* plus GSC_SITE_URL / GA4_PROPERTY_ID to switch to live.",
    "site.liveNote": "Live data retrieved: {q} queries from GSC, {c} channels from GA4.",
    "site.failed": "Pull failed: {msg}",
    "site.awaiting": "Awaiting pull",
    "site.queries": "Top 8 organic queries (by impressions)",
    "site.channels": "Traffic channel mix",
    "site.insights": "Actionable insights",
    "site.insightsDesc": "Sorted by priority, each with evidence numbers and a concrete action.",
    "site.insightsEmpty": "No insight thresholds triggered in the current window.",
    "site.opportunities": "Opportunity keywords",
    "site.opportunitiesDesc": "High impressions with low CTR, or ranking 4–15 and one push away.",
    "site.opportunitiesEmpty": "No clear opportunity keywords in this window (impressions ≥ 50 and CTR below the norm for that rank).",
    "site.pages": "Landing page performance",
    "site.pagesDesc": "Pages with engagement rate below 40% and meaningful views are budget leaks.",
    "site.evidence": "Evidence: {text}",
    "site.action": "Action: {text}",

    "gsc.clicks": "Organic clicks",
    "gsc.impressions": "Impressions",
    "gsc.ctr": "CTR",
    "gsc.position": "Avg position",
    "gsc.queryCount": "Queries with data",
    "gsc.delta": "Click change",
    "gsc.deltaValue": "{v}% (last {n}d vs previous {n}d)",
    "gsc.deltaNa": "Not enough sample",
    "gsc.queryValue": "{i} impr · {c} clicks · CTR {ctr}",
    "gsc.rank": "Pos {p}",

    "ga4.users": "Active users",
    "ga4.sessions": "Sessions",
    "ga4.views": "Page views",
    "ga4.engagement": "Engagement rate",
    "ga4.duration": "Avg duration",
    "ga4.durationValue": "{n}s",
    "ga4.conversions": "Conv. / CVR",
    "ga4.channelValue": "{s} sessions · engagement {e}",
    "ga4.pageValue": "{v} views · {u} users",
    "ga4.engage": "Engagement {e}",
    "ga4.property": "property {id}",

    "sources.title": "Data source status",
    "sources.desc": "Connectors switch from demo to live-ready once configured.",
    "sources.openConsole": "Open console",
    "sources.openTransparency": "Open transparency center",
    "sources.missing": "Needs config: {list}",
    "sources.ready": "{key} ready",

    "ad.transparency": "Transparency center",
    "ad.landing": "Landing page",
    "ad.noImage": "No image creative",
    "ad.empty": "No ad creatives for the current filter.",
    "ad.brief": "Generate brief",
    "ad.briefRunning": "Generating brief…",
    "ad.briefAi": "Done (AI)",
    "ad.briefTemplate": "Done (template)",
    "ad.briefFailed": "Failed, click to retry",
    "ad.rules": "{n} inherited rules",

    "common.empty": "No data yet.",
    "common.dash": "-"
  },

  zh: {
    "brand.tagline": "海外广告情报",
    "lang.en": "EN",
    "lang.zh": "中文",

    "nav.overview": "总览",
    "nav.ads": "广告库",
    "nav.trends": "趋势",
    "nav.iteration": "素材迭代",
    "nav.generate": "素材生成",
    "nav.site": "站点数据",
    "nav.sources": "数据源",

    "mode.demo": "Demo mode",
    "mode.live": "Live mixed",
    "mode.idle": "等待查询",
    "mode.ready": "Connector ready",

    "hero.title": "海外广告素材迭代平台",
    "hero.desc": "输入品牌网站，聚合广告透明度来源；导入平台效果数据后，客户层级素材要求会自动继承到每一轮迭代 Brief。",

    "auth.quota": "剩余 {n} 次",
    "auth.quotaInit": "剩余 10 次",
    "auth.quotaEmpty": "今日额度已用完",
    "auth.logout": "退出",
    "auth.open": "登录 / 注册",
    "auth.loginRequired": "请先登录或注册账号，登录后每天可拉取 10 次数据。",
    "auth.needLogin": "请先登录后再操作。",
    "auth.titleLogin": "登录后开始使用",
    "auth.titleSignup": "创建账号",
    "auth.subLogin": "登录后可每天拉取数据（额度每日重置）。",
    "auth.subSignup": "免费注册即享每日额度，密码至少 8 位。",
    "auth.submitLogin": "登录",
    "auth.submitSignup": "注册",
    "auth.submitLoginLoading": "登录中…",
    "auth.submitSignupLoading": "注册中…",
    "auth.loginFailed": "操作失败，请重试。",
    "auth.email": "邮箱",
    "auth.password": "密码",
    "auth.passwordHint": "至少 8 位",
    "auth.close": "关闭",

    "query.website": "目标网站",
    "query.window": "时间窗口",
    "query.window.30": "近 30 天",
    "query.window.60": "近 60 天",
    "query.window.90": "近 90 天",
    "query.market": "市场",
    "query.run": "自动拉取",
    "query.running": "拉取中",
    "query.runError": "无法完成拉取：{msg}",
    "query.scanning": "正在拉取广告透明度中心数据，并生成竞品趋势信号。",
    "query.done": "{domain} 已完成分析，当前返回 {n} 条广告素材。",

    "status.ready": "Ready",
    "status.readyDesc": "输入域名后开始扫描广告透明度中心和趋势信号。",
    "status.error": "Error",
    "status.loginRequired": "需要登录",

    "metric.ads": "广告素材",
    "metric.adsHint": "透明度来源匹配",
    "metric.hot": "高热度素材",
    "metric.competitors": "竞品域名",
    "metric.competitorsHint": "同类投放重叠",
    "metric.trends": "趋势信号",
    "metric.trendsHint": "等待分析",
    "metric.backlog": "迭代任务",
    "metric.backlogHint": "等待规则继承",
    "metric.rules": "{n} 条继承规则",

    "panel.competitors": "竞品雷达",
    "panel.competitorsDesc": "可作为下一轮关键词和素材拆解对象。",
    "panel.ads": "热门广告",
    "panel.adsDesc": "按热度、投放信号和趋势词排序。",
    "panel.trends": "趋势机会",
    "panel.trendsDesc": "把热词转成广告角度和落地页优先级。",
    "panel.iteration": "素材迭代中枢",
    "panel.iterationDesc": "客户规则向下继承，广告平台数据向上反哺，自动生成下一轮素材 Brief。",
    "panel.sample": "填入示例数据",
    "panel.rules": "继承后的素材要求",
    "panel.rulesDesc": "客户、品牌、市场、平台、活动层级合并结果。",
    "panel.signals": "数据反哺信号",
    "panel.signalsDesc": "用 CTR、CVR、CPA、ROAS 判断放量或重构。",
    "panel.summary": "平台数据摘要",
    "panel.summaryDesc": "导入数据为空时会使用演示数据。",
    "panel.brief": "下一轮素材 Brief",
    "panel.briefDesc": "把表现数据和继承规则转成生产、投放、落地页都能执行的任务。",

    "iter.globalRules": "客户基线要求",
    "iter.globalRulesValue": "品牌名\n核心产品\n明确 CTA\n避免绝对化第一\n优惠与落地页一致",
    "iter.channelRules": "市场 / 平台补充要求",
    "iter.channelRulesValue": "本地货币或本地权益\nMeta 前 3 秒出现核心卖点\nGoogle 标题覆盖高意图关键词\n每个角度保留一个无折扣对照组",
    "iter.csv": "广告平台数据 CSV",
    "iter.csvFile": "导入 CSV 文件",
    "iter.run": "生成迭代",
    "iter.running": "生成中",
    "iter.failed": "无法生成迭代：{msg}",
    "iter.chain": "继承链路",
    "iter.required": "必备元素",
    "iter.banned": "禁用表述",
    "iter.visual": "视觉规则",
    "iter.offer": "优惠规则",
    "iter.ruleCount": "{n} 条",

    "sum.mode": "数据模式",
    "sum.modeImported": "CSV imported",
    "sum.modeDemo": "Demo data",
    "sum.rows": "素材行数",
    "sum.spend": "总花费",
    "sum.conversions": "总转化",
    "sum.roas": "整体 ROAS",
    "sum.best": "最佳素材",
    "sum.ctr": "平均 CTR",
    "sum.cvr": "平均 CVR",
    "sum.cpa": "平均 CPA",

    "brief.actions": "执行动作",
    "brief.checklist": "继承检查",
    "brief.prompt": "生成提示词",

    "gen.title": "素材生成 · Qwen 文生图",
    "gen.desc": "输入创意提示词，调用 Qwen 图像模型生成广告素材（密钥由服务端注入，不暴露在浏览器）。",
    "gen.helper": "DeepSeek 提示词 / 文案器",
    "gen.helperDesc":
      "输入粗略想法，由 DeepSeek 扩写成精修文生图提示词与广告文案（纯文本，不消耗生图额度），再一键交给 Qwen 出图。",
    "gen.helperBadge": "文本由 DeepSeek 生成",
    "gen.idea": "粗略想法 / 核心卖点",
    "gen.ideaPlaceholder": "例如：户外藤编收纳篮，主打小户型阳台收纳，温暖自然风，体现防晒耐候",
    "gen.platform": "目标平台",
    "gen.platformMeta": "Meta（信息流 / 短视频）",
    "gen.platformGoogle": "Google（搜索 / 展示）",
    "gen.platformBing": "Bing",
    "gen.ratio": "画面比例",
    "gen.ratio169": "16:9 横版",
    "gen.ratio43": "4:3",
    "gen.ratio11": "1:1 方图",
    "gen.ratio34": "3:4",
    "gen.ratio916": "9:16 竖版",
    "gen.dsRun": "DeepSeek 生成提示词+文案",
    "gen.dsRunning": "生成中…",
    "gen.dsWaiting": "DeepSeek 正在撰写提示词与文案，约 5–20 秒…",
    "gen.dsEmpty": "请先输入粗略想法或核心卖点。",
    "gen.dsResult": "DeepSeek 生成结果",
    "gen.dsUse": "用此提示词生成图片 →",
    "gen.dsFailed": "生成失败：{msg}",
    "gen.prompt": "提示词 (Prompt)",
    "gen.promptPlaceholder": "例如：写实风格户外家居广告，暖色调，阳光洒在庭院，产品居中，留白充足，适合 Meta 信息流",
    "gen.negative": "负面提示词（可选）",
    "gen.negativePlaceholder": "如：文字、水印、变形、低质",
    "gen.run": "生成素材",
    "gen.running": "生成中…",
    "gen.statusRunning": "Qwen 正在生成，约 10–40 秒",
    "gen.statusWaiting": "生成中，请稍候…",
    "gen.statusDone": "完成，已生成 {n} 张",
    "gen.statusFailed": "生成失败",
    "gen.emptyPrompt": "请先输入提示词",
    "gen.needPrompt": "输入提示词后再生成。",
    "gen.openOriginal": "打开原图",
    "gen.failed": "生成失败：{msg}",

    "site.title": "站点数据 · GSC + GA4",
    "site.desc": "自然搜索需求侧（曝光 / 点击 / 排名）与站内供给侧（渠道 / 落地页 / 转化）合并看，输出可直接派工的动作。",
    "site.website": "站点域名",
    "site.gscUrl": "GSC 媒体资源 siteUrl",
    "site.gscUrlPlaceholder": "留空用服务端 GSC_SITE_URL，例如 sc-domain:adradarhub.com",
    "site.ga4Id": "GA4 媒体资源 ID",
    "site.ga4IdPlaceholder": "留空用服务端 GA4_PROPERTY_ID，纯数字",
    "site.window": "时间窗口",
    "site.window.7": "近 7 天",
    "site.window.28": "近 28 天",
    "site.window.56": "近 56 天",
    "site.window.90": "近 90 天",
    "site.run": "拉取站点数据",
    "site.running": "拉取中…",
    "site.pulling": "正在拉取 GSC 与 GA4 数据…",
    "site.note": "未配置 Google 服务账号时返回演示数据，页面流程与字段含义可直接演示。",
    "site.demoNote": "当前含演示数据。配置 GOOGLE_SERVICE_ACCOUNT_* + GSC_SITE_URL / GA4_PROPERTY_ID 后自动切 live。",
    "site.liveNote": "已取到 live 数据：GSC {q} 个词，GA4 {c} 个渠道。",
    "site.failed": "拉取失败：{msg}",
    "site.awaiting": "等待拉取",
    "site.queries": "自然搜索词 Top 8（按曝光）",
    "site.channels": "流量渠道结构",
    "site.insights": "可执行洞察",
    "site.insightsDesc": "按优先级排序，每条带证据数字与具体动作。",
    "site.insightsEmpty": "当前数据窗口没有触发洞察阈值。",
    "site.opportunities": "机会词",
    "site.opportunitiesDesc": "高曝光低 CTR，或排名第 4–15 位临门一脚。",
    "site.opportunitiesEmpty": "当前窗口没有明显的机会词（曝光 ≥ 50 且 CTR 低于同排名正常值）。",
    "site.pages": "落地页表现",
    "site.pagesDesc": "互动率低于 40% 且浏览量较大的页面是预算漏斗。",
    "site.evidence": "证据：{text}",
    "site.action": "动作：{text}",

    "gsc.clicks": "自然点击",
    "gsc.impressions": "曝光量",
    "gsc.ctr": "CTR",
    "gsc.position": "平均排名",
    "gsc.queryCount": "有数据词数",
    "gsc.delta": "点击环比",
    "gsc.deltaValue": "{v}%（后 {n} 天 vs 前 {n} 天）",
    "gsc.deltaNa": "样本不足",
    "gsc.queryValue": "{i} 曝光 · {c} 点击 · CTR {ctr}",
    "gsc.rank": "第 {p} 位",

    "ga4.users": "活跃用户",
    "ga4.sessions": "会话数",
    "ga4.views": "页面浏览",
    "ga4.engagement": "互动率",
    "ga4.duration": "平均时长",
    "ga4.durationValue": "{n}s",
    "ga4.conversions": "转化数 / 转化率",
    "ga4.channelValue": "{s} 会话 · 互动率 {e}",
    "ga4.pageValue": "{v} 浏览 · {u} 用户",
    "ga4.engage": "互动率 {e}",
    "ga4.property": "property {id}",

    "sources.title": "数据源状态",
    "sources.desc": "配置 connector 后会从 demo 切到 live-ready。",
    "sources.openConsole": "打开控制台",
    "sources.openTransparency": "打开透明度中心",
    "sources.missing": "需要配置：{list}",
    "sources.ready": "{key} ready",

    "ad.transparency": "透明度中心",
    "ad.landing": "落地页",
    "ad.noImage": "无图片素材",
    "ad.empty": "当前筛选没有广告素材。",
    "ad.brief": "生成 Brief",
    "ad.briefRunning": "Brief 生成中…",
    "ad.briefAi": "已生成（AI）",
    "ad.briefTemplate": "已生成（模板）",
    "ad.briefFailed": "生成失败，点击重试",
    "ad.rules": "{n} 条继承规则",

    "common.empty": "暂无数据。",
    "common.dash": "-"
  }
};

const ATR_LANG_KEY = "atr_lang";
const ATR_DEFAULT_LANG = "en";

function detectLang() {
  const fromQuery = new URLSearchParams(location.search).get("lang");
  if (fromQuery && ATR_DICT[fromQuery]) return fromQuery;
  const stored = localStorage.getItem(ATR_LANG_KEY);
  if (stored && ATR_DICT[stored]) return stored;
  return ATR_DEFAULT_LANG;
}

let ATR_LANG = typeof document === "undefined" ? ATR_DEFAULT_LANG : detectLang();

function t(key, vars) {
  const table = ATR_DICT[ATR_LANG] || ATR_DICT[ATR_DEFAULT_LANG];
  let text = table[key];
  if (text === undefined) text = (ATR_DICT[ATR_DEFAULT_LANG] || {})[key];
  if (text === undefined) return key;
  if (vars) {
    Object.keys(vars).forEach(name => {
      text = text.replaceAll(`{${name}}`, vars[name]);
    });
  }
  return text;
}

function applyStaticI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  root.querySelectorAll("[data-i18n-value]").forEach(node => {
    node.value = t(node.dataset.i18nValue);
  });
  root.querySelectorAll("[data-i18n-title]").forEach(node => {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });
  root.querySelectorAll("[data-i18n-aria]").forEach(node => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
  document.documentElement.lang = ATR_LANG === "zh" ? "zh-CN" : "en";
  document.querySelectorAll(".lang-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.lang === ATR_LANG);
  });
}

function setLang(lang) {
  if (!ATR_DICT[lang]) return;
  ATR_LANG = lang;
  localStorage.setItem(ATR_LANG_KEY, lang);
  applyStaticI18n();
  // 语言切换后重跑所有动态渲染，避免页面残留上一语言
  if (typeof window.onLangChange === "function") window.onLangChange();
  document.dispatchEvent(new CustomEvent("atr:langchange", { detail: { lang } }));
}

function initLangSwitch() {
  document.querySelectorAll(".lang-btn").forEach(button => {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  });
  applyStaticI18n();
}
