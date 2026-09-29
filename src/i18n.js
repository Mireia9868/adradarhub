// 服务端双语文案：洞察、Brief、报错提示按请求语言生成。
// 用法：请求进入时 setLang(req.body.lang || req.query.lang)，之后各模块直接 tr("key")。
const DICT = {
  en: {
    "iter.level.global": "Account baseline",
    "iter.level.brand": "Brand",
    "iter.level.market": "Market",
    "iter.level.channel": "Platform",
    "iter.level.campaign": "Campaign",

    "iter.objective": "Improve overseas new-customer conversion efficiency",
    "iter.tone": "Credible, direct, with a price anchor",
    "iter.objectiveFallback": "Improve ad efficiency",
    "iter.toneFallback": "Clear and credible",

    "iter.default.global.required": ["Brand name", "Core product", "Clear CTA"],
    "iter.default.global.banned": ["Absolute #1 claims", "Unproven efficacy claims", "Permanent lowest price"],
    "iter.default.global.visual": ["Show the real product above the fold", "Core selling point in the first 3 seconds"],
    "iter.default.global.offer": ["Offers must carry an expiry date", "Pricing must match the landing page"],
    "iter.default.global.compliance": ["Copy must match the ad policy of the target market"],
    "iter.default.brand.required": ["Overseas delivery promise", "After-sales guarantee"],
    "iter.default.brand.visual": ["Avoid pure stock imagery", "Keep brand recognition colors"],
    "iter.default.market.required": ["Local currency or local benefits"],
    "iter.default.market.banned": ["Exaggerated delivery times"],
    "iter.default.market.offer": ["Free-shipping threshold set per market"],
    "iter.default.channel.visual": [
      "Meta: prioritise short-video first-frame hooks",
      "Google: keep keyword coverage in headlines"
    ],
    "iter.default.channel.compliance": ["Match CTA and moderation rules per platform"],
    "iter.default.campaign.required": ["This round's test angle"],
    "iter.default.campaign.offer": ["Keep at least one no-discount control per angle"],

    "iter.signal.scale.title": "{angle} ready to scale",
    "iter.signal.scale.detail":
      "{platform} / {campaign} scored {score}; replicate the structure first, not just the copy.",
    "iter.signal.hook.title": "Above-the-fold hook needs a rebuild",
    "iter.signal.hook.detail": "{angle} CTR {ctr}, below the imported average of {avg}.",
    "iter.signal.cvr.title": "Post-click conversion handoff is weak",
    "iter.signal.cvr.detail": "{angle} gets the clicks but CVR is {cvr}; align the landing page hero with pricing.",
    "iter.signal.rebuild.title": "Low-efficiency creative goes to the rebuild pool",
    "iter.signal.rebuild.detail": "{platform} / {campaign} ROAS {roas}; cut budget or rebuild around a new angle.",

    "iter.fallback.angle": "core selling point",
    "iter.fallback.creative": "top-performing creative structure",

    "iter.brief.scale.problem": "Winning creative needs scaled variants",
    "iter.brief.scale.hypothesis":
      'Keep the benefit and pacing of "{angle}", swap the first frame, price anchor and CTA to widen reach.',
    "iter.brief.scale.actions": [
      "Produce 3 first-frame variants",
      "Keep the same landing page handoff",
      "Split new-customer and remarketing audiences"
    ],
    "iter.brief.scale.metric": "ROAS not below the current average, CTR up 10%",

    "iter.brief.ctr.problem": "Not enough click appeal",
    "iter.brief.ctr.hypothesis":
      'Put "{trend}" in the first 3 seconds and show the product result earlier to fix the weak hook.',
    "iter.brief.ctr.actions": ["Rewrite the first-3-second captions", "Add product usage scenes", "Test question-style headlines"],
    "iter.brief.ctr.metric": "CTR +20%, thumb-stop rate +15%",

    "iter.brief.cvr.problem": "Conversion efficiency too low",
    "iter.brief.cvr.hypothesis":
      "Align the ad promise, pricing benefits and landing page hero to cut post-click drop-off.",
    "iter.brief.cvr.actions": [
      "Check offer consistency",
      "Strengthen the trust module",
      "Test free shipping or instalments separately"
    ],
    "iter.brief.cvr.metric": "CVR +15%, CPA -10%",

    "iter.brief.inherit.problem": "Account rules must be inherited by every creative round",
    "iter.brief.inherit.hypothesis":
      'Turn "{ad}" into a template and auto-attach brand, market, platform and campaign requirements to cut rework.',
    "iter.brief.inherit.actions": [
      "Lock the required-element check",
      "Generate a banned-claim scan",
      "Export the brief for designers and media buyers"
    ],
    "iter.brief.inherit.metric": "Lower creative rework rate, lower review rejection rate",

    "iter.prompt.line1": "Generate an ad creative iteration plan for {platform}.",
    "iter.prompt.line2": "Objective: {objective}.",
    "iter.prompt.line3": "Tone: {tone}.",
    "iter.prompt.line4": "Angle: {angle}.",
    "iter.prompt.line5": "Must include: {items}.",
    "iter.prompt.line6": "Avoid: {items}.",
    "iter.prompt.line7": "Output: 3 headlines, 3 above-the-fold scripts, 1 design brief, 1 landing page handoff note.",

    "site.insight.ctrGap.title": "High impressions, low clicks: title/description miss the intent",
    "site.insight.ctrGap.evidence":
      "{n} queries have CTR below the norm for their rank — about {lost} clicks/month lost on industry CTR curves. Examples: {list}",
    "site.insight.ctrGap.action":
      "Rewrite the title and meta description of these {n} pages (lead with the core selling point in the first 60 characters), and add the same keywords into search ad RSA headlines for an A/B test.",
    "site.insight.ctrGap.item": "{i} impr · CTR {c}% · pos {p}",
    "site.insight.ctrGap.join": "; ",
    "site.insight.ctrGap.detail": "{q} ({i} impr / CTR {c}% / pos {p})",

    "site.insight.nearTop.title": "One push away: ranking 4–15, biggest upside",
    "site.insight.nearTop.evidence": "{n} queries stuck at position 4–15, {imp} impressions in total. Examples: {list}",
    "site.insight.nearTop.action":
      "Pick 3 queries for content reinforcement (add an FAQ block plus internal links to the main conversion page), bid exact match in search ads to fight for top 3, then recheck after 14 days to see whether organic positions move up together.",
    "site.insight.nearTop.item": "pos {p} · {i} impr",
    "site.insight.nearTop.detail": "{q} (pos {p})",

    "site.insight.trend.title": "Organic clicks down vs the previous period",
    "site.insight.trend.evidence":
      "Clicks down {c}% in the last {h} days vs the previous {h} days; impressions changed {i}%",
    "site.insight.trend.actionIndex":
      "Check indexing and robots first: GSC → Page indexing report, confirm pages were not noindexed or failed to crawl; then check whether core keyword rankings were pushed out by competitors.",
    "site.insight.trend.actionSerp":
      "Impressions held but clicks dropped, so the problem is the SERP appearance itself: check whether competitors added ratings or FAQ rich results, and compare whether your title got rewritten.",

    "site.insight.channel.titlePaid": "Paid traffic over half — organic handoff is weak",
    "site.insight.channel.titleMix": "Traffic mix: judge whether more spend makes sense",
    "site.insight.channel.evidence":
      "Paid (Paid Search/Display) is {p}% of sessions, organic search {o}%, total sessions {s}",
    "site.insight.channel.actionPaid":
      "Turn the keywords that converted well in paid into content pages — target organic share above 35% within 30 days; at the same time lower brand-term bids so you stop bidding against yourself.",
    "site.insight.channel.actionOrganic":
      "Organic search is still the main driver ({o}%). Add paid spend on the 3 best-converting pages to amplify a proven handoff path.",
    "site.insight.channel.item": "{s} sessions · engagement {e}%",

    "site.insight.landing.title": "High-traffic, low-engagement pages: budget leaks here",
    "site.insight.landing.evidence":
      "{n} pages have 200+ views but engagement below 40%. Worst: {list}",
    "site.insight.landing.action":
      "Rebuild the first screen around three things: selling point clear in 3 seconds, social proof moved up, form/CTA moved up. Then run one A/B round in the Creative Iteration module and retest with the same ad traffic in two weeks.",
    "site.insight.landing.item": "{v} views · engagement {e}%",
    "site.insight.landing.detail": "{path} ({v} views / engagement {e}%)",

    "site.insight.cvr.title": "Traffic without conversions: the conversion path is broken",
    "site.insight.cvr.evidence": "{s} sessions produced only {c} conversions (CVR {r}%), engagement {e}%",
    "site.insight.cvr.action":
      "First verify in GA4 that key events fire correctly (and that the conversion event is marked as a key event), then break CVR down by channel to tell whether it is a traffic-quality problem or a checkout-flow problem. Do not add budget before that is clear.",

    "site.loadSourceWarning":
      "{label} is configured, but the live fetch failed: {msg}. Showing demo data for now.",

    "intel.warning.mixed": "Some platforms are running live connectors; unconfigured platforms still use demo data.",
    "intel.warning.demo":
      "No platform authorization or internal scraping proxy configured — results are demo data. The page and API flows are fully runnable.",
    "intel.trend.recommendation": "Validate in ad headlines, short-video captions and the landing page first screen.",

    "gsc.error.siteUrlMissing":
      "gsc_site_url_missing: no GSC property specified (sc-domain:example.com or https://example.com/)",
    "gsc.warning.empty":
      "GSC returned no data for {start} ~ {end}: the property may be newly verified or have zero indexed pages.",
    "gsc.error.permissionDenied":
      "gsc_permission_denied: the service account has no access to this property. Go to GSC → Settings → Users and permissions and add the service account email as a restricted user or owner. {detail}",
    "gsc.error.siteNotFound":
      "gsc_site_not_found: the property does not exist or the siteUrl format is wrong (current: {site}). {detail}",
    "gsc.reason.nearTop": "Ranking {p} — breaking into the top 3 can multiply clicks",
    "gsc.reason.ctrGap": "CTR {c}% is below the {e}% normally expected at this rank",
    "gsc.status.detail": "siteUrl={site}",
    "gsc.status.notConfigured": "No GSC property configured",
    "gsc.demoWarning":
      "GSC is not configured — showing demo data. Configure GOOGLE_SERVICE_ACCOUNT_* and GSC_SITE_URL to switch to live.",

    "ga4.error.propertyMissing":
      "ga4_property_id_missing: no GA4 property ID configured (GA4 → Admin → Property settings, digits only)",
    "ga4.warning.empty": "GA4 returned no sessions for {start} ~ {end}: the data stream may not be connected or the ID is wrong.",
    "ga4.error.permissionDenied":
      "ga4_permission_denied: the service account has no access to this GA4 property. Go to GA4 → Admin → Property access management and add the service account email as a Viewer. {detail}",
    "ga4.error.propertyNotFound": "ga4_property_not_found: property ID {id} does not exist or was deleted. {detail}",
    "ga4.status.detail": "property={id}",
    "ga4.status.notConfigured": "No GA4 property ID configured",
    "ga4.demoWarning":
      "GA4 is not configured — showing demo data. Configure GOOGLE_SERVICE_ACCOUNT_* and GA4_PROPERTY_ID to switch to live.",

    "mock.trend.rec0": "Put it in the ad's first-screen headline together with a countdown discount.",
    "mock.trend.rec1": "Split it into standalone search keyword groups and Shopping title terms.",
    "mock.trend.rec2": "Use it in the first 3 seconds of Meta short-video captions.",
    "mock.trend.rec3": "Add it to the trust module on the landing page first screen.",
    "mock.trend.readdyAi": "AI one-click website"
  },

  zh: {
    "iter.level.global": "客户基线",
    "iter.level.brand": "品牌",
    "iter.level.market": "市场",
    "iter.level.channel": "平台",
    "iter.level.campaign": "活动",

    "iter.objective": "提升海外新客转化效率",
    "iter.tone": "可信、直接、有价格锚点",
    "iter.objectiveFallback": "提升广告效率",
    "iter.toneFallback": "清晰可信",

    "iter.default.global.required": ["品牌名", "核心产品", "明确 CTA"],
    "iter.default.global.banned": ["绝对化第一", "未经证明的疗效", "永久最低价"],
    "iter.default.global.visual": ["首屏展示真实产品", "前 3 秒出现核心卖点"],
    "iter.default.global.offer": ["优惠必须有有效期", "价格信息与落地页一致"],
    "iter.default.global.compliance": ["素材文案与目标市场广告政策一致"],
    "iter.default.brand.required": ["海外配送承诺", "售后保障"],
    "iter.default.brand.visual": ["避免纯库存图", "保留品牌识别色"],
    "iter.default.market.required": ["本地货币或本地权益"],
    "iter.default.market.banned": ["夸大配送时效"],
    "iter.default.market.offer": ["按市场区分免邮门槛"],
    "iter.default.channel.visual": ["Meta 优先短视频首帧钩子", "Google 保持标题关键词覆盖"],
    "iter.default.channel.compliance": ["不同平台 CTA 与审核规范匹配"],
    "iter.default.campaign.required": ["本轮测试角度"],
    "iter.default.campaign.offer": ["每个角度至少保留一个无折扣对照组"],

    "iter.signal.scale.title": "{angle} 可放量",
    "iter.signal.scale.detail": "{platform} / {campaign} 综合得分 {score}，优先复制结构而不是只复制文案。",
    "iter.signal.hook.title": "首屏钩子需要重做",
    "iter.signal.hook.detail": "{angle} CTR {ctr}，低于导入数据均值 {avg}。",
    "iter.signal.cvr.title": "点击后转化承接不足",
    "iter.signal.cvr.detail": "{angle} 点击达标但 CVR {cvr}，需要同步落地页首屏与价格信息。",
    "iter.signal.rebuild.title": "低效素材进入重构池",
    "iter.signal.rebuild.detail": "{platform} / {campaign} ROAS {roas}，建议降预算或改角度复测。",

    "iter.fallback.angle": "核心卖点",
    "iter.fallback.creative": "高表现素材结构",

    "iter.brief.scale.problem": "已有高表现素材需要规模化变体",
    "iter.brief.scale.hypothesis": "保留「{angle}」的利益点和节奏，换首帧、价格锚点与 CTA，可扩大受众覆盖。",
    "iter.brief.scale.actions": ["生成 3 个首帧版本", "保留同一落地页承接", "拆分新客与再营销受众"],
    "iter.brief.scale.metric": "ROAS 不低于当前均值，CTR 提升 10%",

    "iter.brief.ctr.problem": "点击吸引力不足",
    "iter.brief.ctr.hypothesis": "把「{trend}」放进前 3 秒，并更早展示产品结果，可改善弱钩子。",
    "iter.brief.ctr.actions": ["重写前 3 秒字幕", "增加产品使用场景", "测试问题式标题"],
    "iter.brief.ctr.metric": "CTR +20%，Thumb-stop rate +15%",

    "iter.brief.cvr.problem": "转化效率不足",
    "iter.brief.cvr.hypothesis": "同步广告承诺、价格权益与落地页首屏，可减少点击后的流失。",
    "iter.brief.cvr.actions": ["核对优惠一致性", "强化信任模块", "单独测试免邮或分期权益"],
    "iter.brief.cvr.metric": "CVR +15%，CPA -10%",

    "iter.brief.inherit.problem": "客户规则需要被每轮素材稳定继承",
    "iter.brief.inherit.hypothesis": "把「{ad}」拆成模板，并自动附加品牌、市场、平台和活动要求，可以减少返工。",
    "iter.brief.inherit.actions": ["锁定必备元素检查", "生成违禁词扫描", "导出给设计与投手的 Brief"],
    "iter.brief.inherit.metric": "素材返工率下降，审核失败率下降",

    "iter.prompt.line1": "为 {platform} 生成广告素材迭代方案。",
    "iter.prompt.line2": "目标：{objective}。",
    "iter.prompt.line3": "语气：{tone}。",
    "iter.prompt.line4": "角度：{angle}。",
    "iter.prompt.line5": "必须包含：{items}。",
    "iter.prompt.line6": "避免：{items}。",
    "iter.prompt.line7": "输出：3 个标题、3 个首屏脚本、1 个设计 Brief、1 个落地页承接建议。",

    "site.insight.ctrGap.title": "高曝光低点击：标题/描述没接住需求",
    "site.insight.ctrGap.evidence":
      "{n} 个词 CTR 低于同排名正常值，按行业 CTR 曲线估算每月少拿约 {lost} 次点击；代表词：{list}",
    "site.insight.ctrGap.action":
      "改这 {n} 个落地页的 title 与 meta description（把核心卖点前置到前 60 字符），同时把同一批词加进搜索广告 RSA 标题做 A/B。",
    "site.insight.ctrGap.item": "{i} 曝光 · CTR {c}% · 第 {p} 位",
    "site.insight.ctrGap.join": "；",
    "site.insight.ctrGap.detail": "{q}（曝光 {i} / CTR {c}% / 排名 {p}）",

    "site.insight.nearTop.title": "临门一脚词：排名 4–15 位，冲前 3 收益最大",
    "site.insight.nearTop.evidence": "{n} 个词卡在第 4–15 位，合计曝光 {imp}；代表词：{list}",
    "site.insight.nearTop.action":
      "挑 3 个词做内容补强（加 FAQ 段落 + 内链指向主转化页），同时在搜索广告里开精确匹配抢前 3 位置，测 14 天看自然位是否同步上移。",
    "site.insight.nearTop.item": "第 {p} 位 · {i} 曝光",
    "site.insight.nearTop.detail": "{q}（第 {p} 位）",

    "site.insight.trend.title": "自然点击环比下滑",
    "site.insight.trend.evidence": "后 {h} 天比前 {h} 天点击下降 {c}%，曝光变化 {i}%",
    "site.insight.trend.actionIndex":
      "先查索引与 robots：GSC → 网页索引报告，确认页面没被 noindex 或抓取失败；再看是不是核心词排名被竞品挤掉。",
    "site.insight.trend.actionSerp":
      "曝光没掉但点击掉了，问题在 SERP 展现本身：检查竞品是否上了评分/FAQ 富摘要，并对比自己的 title 是否被打折重写。",

    "site.insight.channel.titlePaid": "付费流量占比过半，自然承接偏弱",
    "site.insight.channel.titleMix": "流量结构：判断还能不能加投放",
    "site.insight.channel.evidence":
      "付费（Paid Search/Display）占会话 {p}%，自然搜索占 {o}%，总会话 {s}",
    "site.insight.channel.actionPaid":
      "把付费跑出高转化的词反向补成内容页，目标是 30 天内自然占比提到 35% 以上；同时压低品牌词的付费出价，避免自己抢自己。",
    "site.insight.channel.actionOrganic":
      "自然搜索仍是主力（{o}%），可在转化最好的 3 个页面上加投付费，放大已验证的承接路径。",
    "site.insight.channel.item": "{s} 会话 · 互动率 {e}%",

    "site.insight.landing.title": "高流量低互动页面：预算在这里漏",
    "site.insight.landing.evidence": "{n} 个页面浏览量 ≥ 200 但互动率低于 40%；最差：{list}",
    "site.insight.landing.action":
      "按「首屏 3 秒说清卖点 + 社会证明前置 + 表单/CTA 上移」三件事重做首屏，改完进「素材迭代」模块做一轮 A/B，两周后用同一批广告流量复测。",
    "site.insight.landing.item": "{v} 浏览 · 互动率 {e}%",
    "site.insight.landing.detail": "{path}（{v} 浏览 / 互动率 {e}%）",

    "site.insight.cvr.title": "有流量没转化：转化路径断层",
    "site.insight.cvr.evidence": "{s} 会话只产生 {c} 个转化（CVR {r}%），互动率 {e}%",
    "site.insight.cvr.action":
      "先在 GA4 里核对关键事件是否正确打点（转化事件是否被标为 key event），再按渠道拆 CVR 定位是流量质量问题还是结账流程问题；在定位清楚前不要加预算。",

    "site.loadSourceWarning": "已配置 {label}，但 live 取数失败：{msg}。当前显示演示数据。",

    "intel.warning.mixed": "部分平台已使用 live connector，未配置的平台仍使用演示数据。",
    "intel.warning.demo": "当前未配置平台授权或内部抓取代理，结果为演示数据；页面和接口流程已可运行。",
    "intel.trend.recommendation": "优先验证到广告标题、短视频字幕和落地页首屏。",

    "gsc.error.siteUrlMissing": "gsc_site_url_missing: 未指定 GSC 媒体资源（sc-domain:example.com 或 https://example.com/）",
    "gsc.warning.empty": "GSC 在 {start} ~ {end} 内没有返回数据：媒体资源可能刚验证或索引量为 0。",
    "gsc.error.permissionDenied":
      "gsc_permission_denied: 服务账号没有该媒体资源权限。去 GSC → 设置 → 用户和权限，把服务账号邮箱加为「受限用户」或「所有者」。{detail}",
    "gsc.error.siteNotFound": "gsc_site_not_found: 媒体资源不存在或 siteUrl 写法不对（当前 {site}）。{detail}",
    "gsc.reason.nearTop": "排名第 {p} 位，冲进前 3 点击可翻倍级增长",
    "gsc.reason.ctrGap": "CTR {c}% 低于同排名正常值 {e}%",
    "gsc.status.detail": "siteUrl={site}",
    "gsc.status.notConfigured": "未配置 GSC 媒体资源",
    "gsc.demoWarning": "GSC 未配置，当前为演示数据。配置 GOOGLE_SERVICE_ACCOUNT_* 与 GSC_SITE_URL 后自动切 live。",

    "ga4.error.propertyMissing": "ga4_property_id_missing: 未配置 GA4 媒体资源 ID（GA4 → 管理 → 媒体资源设置，纯数字）",
    "ga4.warning.empty": "GA4 在 {start} ~ {end} 内没有会话数据：数据流可能未接入或 ID 填错。",
    "ga4.error.permissionDenied":
      "ga4_permission_denied: 服务账号没有该 GA4 媒体资源权限。去 GA4 → 管理 → 媒体资源访问权限管理，把服务账号邮箱加为「查看者」。{detail}",
    "ga4.error.propertyNotFound": "ga4_property_not_found: 媒体资源 ID {id} 不存在或已删除。{detail}",
    "ga4.status.detail": "property={id}",
    "ga4.status.notConfigured": "未配置 GA4 媒体资源 ID",
    "ga4.demoWarning": "GA4 未配置，当前为演示数据。配置 GOOGLE_SERVICE_ACCOUNT_* 与 GA4_PROPERTY_ID 后自动切 live。",

    "mock.trend.rec0": "放到广告首屏标题，配合倒计时折扣。",
    "mock.trend.rec1": "拆成独立搜索词组和 Shopping 标题词。",
    "mock.trend.rec2": "用于 Meta 短视频前 3 秒字幕。",
    "mock.trend.rec3": "加入落地页首屏信任模块。",
    "mock.trend.readdyAi": "AI 一键生成官网"
  }
};

let CURRENT = "en";

function setLang(lang) {
  CURRENT = DICT[lang] ? lang : "en";
  return CURRENT;
}

function getLang() {
  return CURRENT;
}

function tr(key, vars) {
  const table = DICT[CURRENT] || DICT.en;
  let value = table[key];
  if (value === undefined) value = DICT.en[key];
  if (value === undefined) return key;
  if (Array.isArray(value)) return value.slice();
  if (!vars) return value;
  let text = value;
  Object.keys(vars).forEach(name => {
    text = text.replaceAll(`{${name}}`, vars[name]);
  });
  return text;
}

module.exports = { setLang, getLang, tr, DICT };
