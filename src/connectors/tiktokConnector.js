// TikTok 视频情报 connector。
//
// 为什么不用官方 API：TikTok 没有对标 YouTube Data API v3 的公开数据接口。
//   - Display API：只能读「授权用户自己」的视频，无法按关键词搜他人内容；
//   - Research API：唯一提供关键词视频检索的官方接口，但准入限定为美/欧非营利学术机构
//     的非商业研究，商业团队（GTM / 代理商 / SaaS）明确不符合资格；
//   - Creative Center 匿名 JSON 接口：2026 年起已全部返回 {"code":40101,"msg":"no permission"}。
// 因此本 connector 通过第三方数据服务商（默认 TikHub）以标准 REST 读取 TikTok 公开数据，
// 商用条款由服务商承担；架构上保留 provider 抽象，后续拿到官方资格或换供应商只改环境变量。
//
// 默认 provider：TikHub
//   视频搜索：GET /api/v1/tiktok/app/v3/fetch_video_search_result
//             ?keyword=&offset=&count=&sort_type=&publish_time=&region=
//   单视频：  GET /api/v1/tiktok/app/v3/fetch_one_video?aweme_id=
//   鉴权：    Authorization: Bearer <TIKTOK_API_KEY>
//   注意：中国大陆网络请用 https://api.tikhub.dev（路径参数完全一致）。

const PROVIDERS = {
  tikhub: {
    label: "TikHub TikTok API",
    baseUrlEnv: "TIKTOK_API_BASE_URL",
    defaultBaseUrl: "https://api.tikhub.io",
    searchPath: "/api/v1/tiktok/app/v3/fetch_video_search_result",
    videoPath: "/api/v1/tiktok/app/v3/fetch_one_video",
    sourceUrl: "https://www.tikhub.io/tiktok-api"
  }
};

// sinceDays 映射到接口只支持的几档时间窗口
const PUBLISH_TIME_BUCKETS = [
  { max: 1, value: 1, label: "最近 1 天" },
  { max: 7, value: 7, label: "最近 7 天" },
  { max: 30, value: 30, label: "最近 30 天" },
  { max: 90, value: 90, label: "最近 90 天" },
  { max: Infinity, value: 180, label: "最近 180 天" }
];

async function fetchTikTokIntel(query) {
  const apiKey = process.env.TIKTOK_API_KEY;
  if (!apiKey) {
    throw new Error("tiktok_api_key_missing: TIKTOK_API_KEY 未配置，TikTok 平台回退演示数据");
  }

  const providerName = String(process.env.TIKTOK_PROVIDER || "tikhub").toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`tiktok_provider_unsupported: 不支持的数据源 ${providerName}（目前支持：${Object.keys(PROVIDERS).join(" / ")}）`);
  }

  const term = query.brand || query.website.hostname;
  const sinceDays = Number(query.sinceDays || 30);
  const limit = clampInt(Number(process.env.TIKTOK_SEARCH_LIMIT || 20), 5, 50);
  const region = String(process.env.TIKTOK_REGION || query.markets?.[0] || "US").toUpperCase();
  const bucket = PUBLISH_TIME_BUCKETS.find(item => sinceDays <= item.max);
  const sortType = process.env.TIKTOK_SORT_TYPE === "1" ? 1 : 0;

  const searchParams = new URLSearchParams({
    keyword: term,
    offset: "0",
    count: String(limit),
    // 0 = 综合相关度。不要用 sort_type=1（最多点赞）：会把大量与品牌无关的爆款带进来，
    // 和 YouTube 搜索踩过的坑一样，候选池被噪音占满后再排序也没意义。
    sort_type: String(sortType),
    publish_time: String(bucket.value),
    region
  });

  const payload = await fetchTikTok(
    `${(process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "")}${provider.searchPath}?${searchParams}`
  );

  const awemes = collectAwemes(payload && payload.data);
  if (!awemes.length) {
    return {
      platform: "tiktok",
      sourceMode: "live",
      warnings: [`TikTok（${bucket.label}/${region}）没有搜到与「${term}」相关的视频。`],
      ads: [],
      trends: [],
      competitors: []
    };
  }

  // 品牌相关性校验：第三方搜索结果里混入同名/近形账号很常见（搜 readdy 会带出 Reddy、
  // Ready 等），只保留文案、作者名或话题标签里真正出现品牌词的内容。
  const relevant = filterByBrand(awemes, term);
  const dropped = awemes.length - relevant.length;

  const rows = scoreVideoRows(relevant);
  const warnings = [];
  if (bucket.value !== sinceDays) {
    warnings.push(`TikTok 仅支持固定时间档位，${sinceDays} 天已向上取整到「${bucket.label}」。`);
  }
  if (dropped > 0) {
    warnings.push(`已过滤 ${dropped} 条文案/作者/话题中未出现「${term}」的视频（品牌相关性校验）。`);
  }

  return {
    platform: "tiktok",
    sourceMode: "live",
    warnings,
    ads: rows.map(mapToAd),
    trends: buildHashtagTrends(rows, bucket),
    competitors: buildCreatorCompetitors(rows)
  };
}

// 只保留文案 / 作者 / 话题标签中真正出现品牌词的视频
function filterByBrand(items, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter(item => {
    const haystack = [
      pickText(item, "desc", "description", "title"),
      authorField(item, "unique_id"),
      authorField(item, "nickname"),
      (hashtagsOf(item) || []).join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

// TikHub 各系列返回的层级不统一（data / business_data / data.data / aweme_list 等），
// 文档也不展开 data 结构。这里做一次防御性遍历，把所有含 aweme_id 的对象捞出来，
// 避免因为换系列或改版就整体解析失败。
function collectAwemes(node, out = [], depth = 0) {
  if (!node || typeof node !== "object" || out.length >= 200 || depth > 10) return out;
  if (Array.isArray(node)) {
    for (const child of node) collectAwemes(child, out, depth + 1);
    return out;
  }

  const candidate = node.aweme_info || node.awemeInfo || null;
  if (candidate && (candidate.aweme_id || candidate.statistics)) {
    out.push(candidate);
    return out;
  }
  if (node.aweme_id || node.id) {
    out.push(node);
    return out;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectAwemes(value, out, depth + 1);
  }
  return out;
}

// 纯函数：输入原始 aweme 列表，输出带 Heat / 潜力 / 建议动作的行
function scoreVideoRows(items) {
  const now = Date.now();
  const rows = items.map(item => {
    const created = Number(item.create_time || item.createTime || 0);
    const publishedAt = created ? new Date(created * 1000).toISOString() : null;
    const authorId = authorField(item, "unique_id") || "";
    const views = statNumber(item, "play_count");
    const likes = statNumber(item, "digg_count");
    const comments = statNumber(item, "comment_count");
    const shares = statNumber(item, "share_count");
    const durationMs = Number(item.video?.duration || item.duration || 0);
    const ageDays = publishedAt
      ? Math.max(0.5, (now - new Date(publishedAt).getTime()) / 86400000)
      : 30;

    return {
      videoId: String(item.aweme_id || item.id || ""),
      title: firstLine(pickText(item, "desc", "description", "title")) || "Untitled TikTok",
      description: pickText(item, "desc", "description", "title") || "",
      authorId,
      authorName: authorField(item, "nickname") || authorId || "Unknown creator",
      authorAvatar: pickUrl(item.author?.avatar_thumb || item.author?.avatar_larger || item.author?.avatar),
      followers: Number(item.author?.follower_count || 0),
      music: item.music?.title || "",
      publishedAt,
      ageDays: Math.round(ageDays * 10) / 10,
      durationSeconds: durationMs ? Math.round(durationMs / 1000) : 0,
      views,
      likes,
      comments,
      shares,
      saves: statNumber(item, "collect_count"),
      hashtags: hashtagsOf(item),
      cover: pickUrl(item.video?.cover || item.video?.origin_cover || item.video?.dynamic_cover) || "",
      viewsPerDay: views / ageDays
    };
  });

  const dailyRates = rows.map(row => row.viewsPerDay).filter(value => value > 0).sort((a, b) => a - b);
  const medianViewsPerDay = dailyRates.length ? dailyRates[Math.floor(dailyRates.length / 2)] : 0;
  const maxViews = Math.max(...rows.map(row => row.views), 1);
  const logMax = Math.log10(1 + maxViews);

  for (const row of rows) {
    const viewScore = logMax > 0 ? (Math.log10(1 + row.views) / logMax) * 100 : 0;
    const engagementRate = row.views > 0 ? (row.likes + 3 * row.comments + 2 * row.shares) / row.views : 0;
    // TikTok 互动率基线明显高于 YouTube（评论/转发权重更高），15% 视为满分；
    // 沿用 YouTube 的 8% 会让几乎所有视频都满分，失去区分度。
    const engScore = clampNum((engagementRate / 0.15) * 100, 0, 100);
    const velScore = medianViewsPerDay > 0 ? clampNum((row.viewsPerDay / (medianViewsPerDay * 3)) * 100, 0, 100) : 0;

    row.heat = Math.round(0.45 * viewScore + 0.25 * engScore + 0.3 * velScore);
    row.engagementRate = Number((engagementRate * 100).toFixed(2));

    const outlier = medianViewsPerDay > 0 ? row.viewsPerDay / medianViewsPerDay : 0;
    row.outlierRatio = Number(outlier.toFixed(2));
    row.potentialScore = clampNum(Math.round((outlier / 8) * 100), 0, 100);
    row.potentialLevel =
      outlier >= 3 && row.ageDays >= 2 && row.ageDays <= 14
        ? "高潜力"
        : outlier >= 3
          ? "潜力"
          : "常规";
    row.action = decideAction(row);
  }

  return rows.sort((left, right) => right.heat - left.heat);
}

function decideAction(row) {
  if (row.heat >= 80) return "立即跟进：同选题生成投放 Brief";
  if (row.heat >= 60) return "进选题池：观察 48h 增速再定";
  if (row.potentialLevel === "高潜力") return "抢先测试：竞品未放量窗口期";
  return "归档观察";
}

function mapToAd(row) {
  const url = row.videoId && row.authorId
    ? `https://www.tiktok.com/@${row.authorId}/video/${row.videoId}`
    : "https://www.tiktok.com/";

  return {
    id: `tiktok-${row.videoId}`,
    videoId: row.videoId,
    platform: "tiktok",
    advertiser: `@${row.authorName}`,
    headline: row.title,
    body: row.description || "（无文案）",
    cta: "Watch",
    format: row.durationSeconds ? `Video · ${row.durationSeconds}s` : "Video",
    market: process.env.TIKTOK_REGION || "US",
    firstSeen: row.publishedAt,
    heat: row.heat,
    spendSignal: `${compactNumber(row.views)} plays · 互动率 ${row.engagementRate}%`,
    landingUrl: url,
    sourceUrl: url,
    imageUrl: row.cover,
    music: row.music,
    hashtags: row.hashtags,
    tags: [row.action, `潜力 ${row.potentialScore}`, `Outlier ${row.outlierRatio}x`]
  };
}

// 趋势来源：从命中的视频里聚合话题标签。
// 相比再调一次「平台热门榜」，这个做法是零额外调用、零额外费用，
// 而且得到的是与品牌同赛道的标签，比全站大榜对投放选题更可用。
function buildHashtagTrends(rows, bucket) {
  const grouped = new Map();
  for (const row of rows) {
    for (const tag of row.hashtags) {
      const entry = grouped.get(tag) || { tag, videos: 0, views: 0, likes: 0, heatSum: 0 };
      entry.videos += 1;
      entry.views += row.views;
      entry.likes += row.likes;
      entry.heatSum += row.heat;
      grouped.set(tag, entry);
    }
  }

  const maxHeat = Math.max(...[...grouped.values()].map(item => item.heatSum), 1);

  return [...grouped.values()]
    .filter(item => item.videos >= 1)
    .sort((left, right) => right.heatSum - left.heatSum || right.views - left.views)
    .slice(0, 8)
    .map((item, index) => {
      const avgLikes = item.videos ? Math.round(item.likes / item.videos) : 0;
      return {
        id: `tiktok-trend-${index + 1}`,
        name: `#${item.tag}`,
        score: clampInt(Math.round(52 + (item.heatSum / maxHeat) * 46), 50, 98),
        growth: `+${clampInt(Math.round((item.heatSum / maxHeat) * 40) + 6, 6, 55)}%`,
        type: "TikTok hashtag",
        category: `TikTok · ${bucket.label}`,
        window: bucket.label,
        recommendation:
          item.videos > 1
            ? `${item.videos} 条在榜视频命中，平均 ${compactNumber(avgLikes)} 赞，适合做竖版素材的话题切入点。`
            : "单条视频命中，先作为标题/字幕候选词验证。"
      };
    });
}

// 创作者聚合为竞品卡片
function buildCreatorCompetitors(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row.authorId) continue;
    const entry = grouped.get(row.authorId) || {
      authorId: row.authorId,
      name: row.authorName,
      videos: [],
      totalViews: 0,
      followers: row.followers
    };
    entry.videos.push(row.videoId);
    entry.totalViews += row.views;
    entry.followers = Math.max(entry.followers, row.followers);
    grouped.set(row.authorId, entry);
  }

  const maxAvgViews = Math.max(
    ...[...grouped.values()].map(item => item.totalViews / Math.max(item.videos.length, 1)),
    1
  );

  return [...grouped.values()].map(entry => {
    const avgViews = entry.totalViews / Math.max(entry.videos.length, 1);
    return {
      name: `@${entry.name}`,
      domain: `tiktok.com/@${entry.authorId}`,
      overlap: clampInt(Math.round((avgViews / maxAvgViews) * 85) + 8, 8, 96),
      category: "TikTok Creator",
      signal: `${entry.videos.length} 条在榜视频 · 粉丝 ${compactNumber(entry.followers)} · 均播 ${compactNumber(Math.round(avgViews))}`,
      source: "TikTok video intelligence"
    };
  });
}

// Brief 原料：单视频完整信息
async function fetchVideoForBrief(videoId) {
  const apiKey = process.env.TIKTOK_API_KEY;
  if (!apiKey) {
    const error = new Error("tiktok_api_key_missing: 生成 Brief 前请先配置 TIKTOK_API_KEY");
    error.statusCode = 400;
    throw error;
  }
  const providerName = String(process.env.TIKTOK_PROVIDER || "tikhub").toLowerCase();
  const provider = PROVIDERS[providerName] || PROVIDERS.tikhub;
  const baseUrl = (process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, "");

  const payload = await fetchTikTok(
    `${baseUrl}${provider.videoPath}?${new URLSearchParams({ aweme_id: String(videoId || "").trim() })}`
  );
  const item = collectAwemes(payload && payload.data)[0];
  if (!item) {
    const error = new Error("video_not_found");
    error.statusCode = 404;
    throw error;
  }

  const row = scoreVideoRows([item])[0];
  return {
    videoId: row.videoId,
    title: row.title,
    description: row.description,
    channelTitle: `@${row.authorName}`,
    authorHandle: row.authorId,
    followers: row.followers,
    music: row.music,
    hashtags: row.hashtags,
    durationSeconds: row.durationSeconds,
    publishedAt: row.publishedAt,
    statistics: {
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves
    },
    scores: {
      heat: row.heat,
      engagementRate: row.engagementRate,
      potentialLevel: row.potentialLevel,
      outlierRatio: row.outlierRatio
    },
    url: row.videoId && row.authorId
      ? `https://www.tiktok.com/@${row.authorId}/video/${row.videoId}`
      : "https://www.tiktok.com/"
  };
}

// 未配置 DeepSeek 时的规则版 Brief 兜底
function buildBriefFallback(video, brand) {
  const name = brand || "我方品牌";
  const handle = video.authorHandle ? `@${video.authorHandle}` : video.channelTitle || "未知作者";
  return [
    "【TikTok 视频情报速览】",
    `${handle} 的《${video.title}》：${compactNumber(video.statistics.views)} 播放、` +
      `${compactNumber(video.statistics.likes)} 赞、互动率 ${video.scores?.engagementRate ?? "-"}%。`,
    "",
    "【Hook 拆解（需看片确认）】",
    "1. 记录前 3 秒画面、字幕与第一句话；",
    "2. 判断钩子类型：痛点提问 / 反常识结论 / 结果前置；",
    "3. 记录字幕出现节奏与画面切换频率（TikTok 建议每 1.5-2 秒一次变化）。",
    "",
    "【结构复刻脚本】",
    `0-3s：复刻钩子节奏，替换为 ${name} 的痛点场景；`,
    "3-15s：搬结构不搬内容，映射到我方核心卖点；",
    "15-30s：证据段（前后对比 / 真实使用场景 / 用户证言）；",
    "结尾：口播 + 字幕双 CTA（注册 / 试用 / 领券）。",
    "",
    "【投放标题 ×3】",
    `1. ${video.title}（原题结构 + 我方关键词）`,
    "2. 痛点提问式标题",
    "3. 结果承诺式标题",
    "",
    "【拍摄规格建议】",
    "竖版 9:16、1080×1920、15-30 秒；字幕硬编码、带 BGM、前三秒必须有画面变化。",
    "",
    "【投放建议】",
    "TikTok 素材可直接复用为 Meta Reels 与 YouTube Shorts，先跑短视频低成本赛马再放量。"
  ].join("\n");
}

function getTikTokStatus() {
  const configured = Boolean(process.env.TIKTOK_API_KEY);
  const providerName = String(process.env.TIKTOK_PROVIDER || "tikhub").toLowerCase();
  return {
    platform: "tiktok",
    label: "TikTok video search",
    provider: providerName,
    configured,
    mode: configured ? "live-ready" : "demo",
    route: configured ? "direct" : "demo",
    access: "third-party-api-key",
    envKey: "TIKTOK_API_KEY",
    directKey: "TIKTOK_API_KEY",
    missing: configured ? [] : ["TIKTOK_API_KEY"],
    sourceUrl: (PROVIDERS[providerName] || PROVIDERS.tikhub).sourceUrl
  };
}

async function fetchTikTok(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.TIKTOK_API_KEY}`,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 25000))
  });

  const text = await response.text().catch(() => "");
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`tiktok_api_failed:${response.status}: 响应不是合法 JSON（${text.slice(0, 120)}）`);
  }

  if (!response.ok) {
    throw new Error(translateTikHubError(response.status, payload, text));
  }
  if (payload && payload.code && Number(payload.code) !== 200) {
    throw new Error(`tiktok_api_failed:${payload.code}:${payload.message || payload.message_zh || "未知错误"}`);
  }
  return payload;
}

// TikHub 的 HTTP 状态码带钱的事：单独翻译，方便一眼判断是「没充钱」还是「被限流」
function translateTikHubError(status, payload, text) {
  const detail = payload?.message_zh || payload?.message || text.slice(0, 160);
  if (status === 401) return `tiktok_auth_failed: API Key 无效或未激活（${detail}）`;
  if (status === 402) return `tiktok_balance_insufficient: 账户余额不足，需充值（${detail}）`;
  if (status === 403) return `tiktok_forbidden: Key 没有该接口的权限（${detail}）`;
  if (status === 429) return `tiktok_rate_limited: 请求过快被限流（${detail}）`;
  if (status === 404) return `tiktok_not_found: 接口或数据不存在（${detail}）`;
  return `tiktok_api_failed:${status}:${detail}`;
}

// aweme 的统计字段在 App V3 / Web 系列里位置不同（statistics / stats / 顶层），逐个兜底
function statNumber(item, field) {
  const sources = [item.statistics, item.stats, item];
  for (const source of sources) {
    const value = Number(source?.[field]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function authorField(item, field) {
  return pickText(item.author, field) || pickText(item.author_info, field) || "";
}

function pickText(source, ...fields) {
  for (const field of fields) {
    const value = source?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

// 封面/头像这类字段结构统一是 xxx.url_list[0]，也可能是字符串裸 URL
function pickUrl(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  const list = node.url_list || node.urlList;
  if (Array.isArray(list) && list.length) return list[0];
  return node.url || "";
}

// TikHub 的 cha_list 不一定返回，从文案里直接抽更稳定
function hashtagsOf(item) {
  const source = item?.cha_list || item?.text_extra || null;
  if (Array.isArray(source) && source.length) {
    const tags = source
      .map(entry => entry?.cha_name || entry?.hashtag_name || (typeof entry === "string" ? entry : ""))
      .map(tag => String(tag).replace(/^#/, "").trim())
      .filter(Boolean);
    if (tags.length) return [...new Set(tags)].slice(0, 8);
  }
  const desc = pickText(item, "desc", "description", "title");
  const matched = String(desc).match(/#[\p{L}\p{N}_]+/gu) || [];
  return [...new Set(matched.map(tag => tag.replace(/^#/, "")))].slice(0, 8);
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/)[0].trim();
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function clampNum(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function clampInt(value, min, max) {
  return clampNum(Math.round(value), min, max);
}

module.exports = {
  fetchTikTokIntel,
  scoreVideoRows,
  collectAwemes,
  fetchVideoForBrief,
  buildBriefFallback,
  getTikTokStatus,
  PROVIDERS
};
