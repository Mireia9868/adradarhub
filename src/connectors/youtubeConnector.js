// YouTube Data API v3 connector：品牌关键词搜索近期高观看视频，
// 用官方统计字段计算 Heat / Potential / 建议动作，视频映射为标准 ad 卡片进聚合流。
// 配额：search.list = 100 units/次，videos.list = 1 unit/次（50 个视频），channels.list = 1 unit/次。
const API_BASE = "https://www.googleapis.com/youtube/v3";

async function fetchYouTubeIntel(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("youtube_api_key_missing: YOUTUBE_API_KEY 未配置，YouTube 平台回退演示数据");
  }

  const term = query.brand || query.website.hostname;
  const sinceDays = Number(query.sinceDays || 30);
  const limit = clampInt(Number(process.env.YOUTUBE_SEARCH_LIMIT || 15), 1, 25);

  // 默认用引号做精确短语搜索：不加引号时 YouTube 会模糊匹配（搜 readdy 会返回宝莱坞歌曲），
  // 加引号后稳定命中品牌自身与 KOL 评测内容。可用 YOUTUBE_EXACT_PHRASE=false 关闭。
  const exactPhrase = String(process.env.YOUTUBE_EXACT_PHRASE || "true").toLowerCase() !== "false";
  const searchParams = new URLSearchParams({
    key: apiKey,
    part: "id",
    q: exactPhrase ? `"${term}"` : term,
    type: "video",
    // 用相关性而不是播放量取候选：order=viewCount 会把品牌词当常见词变体匹配
    // （搜 readdy 返回嘻哈/板球/政治视频），候选池被噪音占满后再怎么排序都没用。
    // 相关性由搜索保证，热度由本地 Heat 分负责。
    order: process.env.YOUTUBE_SEARCH_ORDER || "relevance",
    maxResults: String(limit),
    publishedAfter: new Date(Date.now() - sinceDays * 86400000).toISOString(),
    // 默认限制在英语/美国市场，进一步压掉非目标语种的噪音；可用环境变量覆盖。
    regionCode: process.env.YOUTUBE_REGION_CODE || "US",
    relevanceLanguage: process.env.YOUTUBE_RELEVANCE_LANGUAGE || "en"
  });

  const search = await fetchJson(`${API_BASE}/search?${searchParams}`);
  const videoIds = (search.items || []).map(item => item.id?.videoId).filter(Boolean);
  if (!videoIds.length) {
    return {
      platform: "youtube",
      sourceMode: "live",
      warnings: [`YouTube 近 ${sinceDays} 天内没有搜到与「${term}」相关的视频。`],
      ads: [],
      trends: [],
      competitors: []
    };
  }

  const videoPayload = await fetchJson(
    `${API_BASE}/videos?${new URLSearchParams({
      key: apiKey,
      part: "snippet,statistics,contentDetails",
      id: videoIds.join(",")
    })}`
  );
  // 品牌相关性校验：搜索仍可能返回只是"形似"品牌词的内容（如 readdy 匹配到人名 Reddy、
  // 嘻哈歌词里的 readdy）。只保留标题/频道名/描述里真正出现品牌词的视频。
  const relevantItems = filterByBrand(videoPayload.items || [], term);
  const droppedByRelevance = (videoPayload.items || []).length - relevantItems.length;

  const channelIds = [
    ...new Set(relevantItems.map(item => item.snippet?.channelId).filter(Boolean))
  ];
  const channelPayload = channelIds.length
    ? await fetchJson(
        `${API_BASE}/channels?${new URLSearchParams({
          key: apiKey,
          part: "snippet,statistics",
          id: channelIds.join(",")
        })}`
      ).catch(() => ({ items: [] }))
    : { items: [] };

  const channelById = new Map(
    (channelPayload.items || []).map(channel => [channel.id, channel])
  );
  const scored = scoreVideoRows(relevantItems);
  const warnings = [];
  if (search.pageInfo?.totalResults > videoIds.length) {
    warnings.push(
      `YouTube 命中 ${search.pageInfo.totalResults} 条，按相关性取前 ${videoIds.length} 条（配额控制）。`
    );
  }
  if (droppedByRelevance > 0) {
    warnings.push(
      `已过滤 ${droppedByRelevance} 条标题/频道/描述中未出现「${term}」的视频（品牌相关性校验）。`
    );
  }

  return {
    platform: "youtube",
    sourceMode: "live",
    warnings,
    ads: scored.map(row => mapToAd(row, channelById)),
    trends: [],
    competitors: buildChannelCompetitors(scored, channelById, query)
  };
}

// 只保留标题 / 频道名 / 描述中真正出现品牌词的视频
function filterByBrand(items, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter(item => {
    const haystack = [
      item.snippet?.title,
      item.snippet?.channelTitle,
      (item.snippet?.description || "").slice(0, 800)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

// 纯函数，便于离线回测调权重：输入 videos.list 原始 items，输出带分数的行
function scoreVideoRows(items) {
  const now = Date.now();
  const rows = items.map(item => {
    const stats = item.statistics || {};
    const views = Number(stats.viewCount || 0);
    const likes = Number(stats.likeCount || 0);
    const comments = Number(stats.commentCount || 0);
    const publishedAt = item.snippet?.publishedAt || null;
    const ageDays = publishedAt ? Math.max(0.5, (now - new Date(publishedAt).getTime()) / 86400000) : 30;
    return {
      videoId: item.id,
      title: item.snippet?.title || "Untitled video",
      description: (item.snippet?.description || "").slice(0, 400),
      channelTitle: item.snippet?.channelTitle || "Unknown channel",
      channelId: item.snippet?.channelId || "",
      publishedAt,
      ageDays: Math.round(ageDays * 10) / 10,
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
      views,
      likes,
      comments,
      viewsPerDay: views / ageDays,
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        ""
    };
  });

  const dailyRates = rows.map(row => row.viewsPerDay).filter(value => value > 0).sort((a, b) => a - b);
  const medianViewsPerDay = dailyRates.length ? dailyRates[Math.floor(dailyRates.length / 2)] : 0;
  const maxViews = Math.max(...rows.map(row => row.views), 1);
  const logMax = Math.log10(1 + maxViews);

  for (const row of rows) {
    const viewScore = logMax > 0 ? (Math.log10(1 + row.views) / logMax) * 100 : 0;
    const engagementRate = row.views > 0 ? (row.likes + 3 * row.comments) / row.views : 0;
    // 互动率 8% 视为满分（消费品/科技频道基线约 3-6%）
    const engScore = clampNum((engagementRate / 0.08) * 100, 0, 100);
    // 日均观看达到结果集中位数的 3 倍即满分
    const velScore = medianViewsPerDay > 0 ? clampNum((row.viewsPerDay / (medianViewsPerDay * 3)) * 100, 0, 100) : 0;
    row.heat = Math.round(0.45 * viewScore + 0.25 * engScore + 0.3 * velScore);
    row.engagementRate = Number((engagementRate * 100).toFixed(2));

    const outlier = medianViewsPerDay > 0 ? row.viewsPerDay / medianViewsPerDay : 0;
    row.outlierRatio = Number(outlier.toFixed(2));
    row.potentialScore = clampNum(Math.round((outlier / 8) * 100), 0, 100);
    // 2-14 天龄 + 3 倍于中位增速 = 竞品还没放量的窗口期
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

function mapToAd(row, channelById) {
  const channel = channelById.get(row.channelId);
  return {
    id: `youtube-${row.videoId}`,
    videoId: row.videoId,
    platform: "youtube",
    advertiser: row.channelTitle,
    headline: row.title,
    body: row.description || "（无描述）",
    cta: "Watch",
    format: `Video · ${formatDuration(row.durationSeconds)}`,
    market: channel?.snippet?.country || "Global",
    firstSeen: row.publishedAt,
    heat: row.heat,
    spendSignal: `${compactNumber(row.views)} views · 互动率 ${row.engagementRate}%`,
    landingUrl: `https://www.youtube.com/watch?v=${row.videoId}`,
    sourceUrl: `https://www.youtube.com/watch?v=${row.videoId}`,
    imageUrl: row.thumbnail,
    tags: [row.action, `潜力 ${row.potentialScore}`, `Outlier ${row.outlierRatio}x`]
  };
}

// 频道聚合为竞品卡片（订阅数 / 在榜视频数 / 平均观看）
function buildChannelCompetitors(rows, channelById, query) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row.channelId) continue;
    const existing = grouped.get(row.channelId) || {
      channelId: row.channelId,
      name: row.channelTitle,
      domain: `youtube.com/channel/${row.channelId}`,
      videos: [],
      totalViews: 0
    };
    existing.videos.push(row.videoId);
    existing.totalViews += row.views;
    grouped.set(row.channelId, existing);
  }

  return [...grouped.values()].map(entry => {
    const channel = channelById.get(entry.channelId);
    return {
      name: entry.name,
      domain: entry.domain,
      overlap: clampInt(Math.round((entry.totalViews / Math.max(entry.videos.length, 1)) / 10000), 5, 98),
      category: channel?.snippet?.country ? `YouTube · ${channel.snippet.country}` : "YouTube",
      signal: `${entry.videos.length} 条在榜视频 · 订阅 ${compactNumber(Number(channel?.statistics?.subscriberCount || 0))}`,
      source: "YouTube Data API v3"
    };
  });
}

// Brief 生成原料：单视频完整信息
async function fetchVideoForBrief(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    const error = new Error("youtube_api_key_missing: 生成 Brief 前请先配置 YOUTUBE_API_KEY");
    error.statusCode = 400;
    throw error;
  }
  const payload = await fetchJson(
    `${API_BASE}/videos?${new URLSearchParams({
      key: apiKey,
      part: "snippet,statistics,contentDetails",
      id: String(videoId || "").trim()
    })}`
  );
  const item = payload.items?.[0];
  if (!item) {
    const error = new Error("video_not_found");
    error.statusCode = 404;
    throw error;
  }
  return {
    videoId: item.id,
    title: item.snippet?.title,
    description: item.snippet?.description,
    channelTitle: item.snippet?.channelTitle,
    publishedAt: item.snippet?.publishedAt,
    tags: item.snippet?.tags || [],
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    statistics: {
      views: Number(item.statistics?.viewCount || 0),
      likes: Number(item.statistics?.likeCount || 0),
      comments: Number(item.statistics?.commentCount || 0)
    },
    url: `https://www.youtube.com/watch?v=${item.id}`
  };
}

// 未配置 DeepSeek 时的规则版 Brief 兜底
function buildBriefFallback(video, brand) {
  return [
    "【视频情报速览】",
    `${video.channelTitle} 的《${video.title}》：${compactNumber(video.statistics.views)} 次观看、互动率按赞评比可复核。`,
    "",
    "【Hook 拆解（待人工看片确认）】",
    "1. 记录前 3 秒画面与第一句话；",
    "2. 判断钩子类型：痛点提问 / 反常识结论 / 结果前置；",
    "3. 记录信息密度节奏（每几秒一个信息点）。",
    "",
    "【结构复刻脚本】",
    "0-5s：复刻钩子节奏，替换为 " + (brand || "我方品牌") + " 痛点；",
    "5-20s：搬结构不搬内容，映射我方核心卖点；",
    "20-45s：证据段（对比 / 数据 / 使用场景）；",
    "结尾：明确 CTA（注册 / 试用 / 领券）。",
    "",
    "【标题选项 ×3】",
    `1. ${video.title}（原题结构 + 我方关键词）`,
    "2. 痛点提问式标题",
    "3. 结果承诺式标题",
    "",
    "【缩略图方向 ×2】",
    "1. 原视频缩略图构图复刻（人物表情 + 大字）；",
    "2. 数据对比式（前后对比 / 数字放大）。",
    "",
    "【投放建议】",
    "YouTube 素材优先二次剪成 15-30s 竖版，迁移 Google Demand Gen 与 Meta Reels 测试。"
  ].join("\n");
}

function getYoutubeStatus() {
  const configured = Boolean(process.env.YOUTUBE_API_KEY);
  return {
    platform: "youtube",
    label: "YouTube Data API v3",
    configured,
    mode: configured ? "live-ready" : "demo",
    route: configured ? "direct" : "demo",
    access: "official-api-key",
    envKey: "YOUTUBE_API_KEY",
    directKey: "YOUTUBE_API_KEY",
    missing: configured ? [] : ["YOUTUBE_API_KEY"],
    sourceUrl: "https://console.cloud.google.com/apis/library/youtube.googleapis.com"
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000))
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`youtube_api_failed:${response.status}:${text.slice(0, 120)}`);
  }
  return response.json();
}

function parseIsoDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ""));
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function formatDuration(seconds) {
  if (!seconds) return "时长未知";
  const minutes = Math.round(seconds / 60);
  return minutes >= 1 ? `${minutes} min` : `${seconds}s`;
}

function compactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value || 0);
}

function clampNum(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function clampInt(value, min, max) {
  return clampNum(Math.round(value), min, max);
}

module.exports = {
  fetchYouTubeIntel,
  scoreVideoRows,
  fetchVideoForBrief,
  buildBriefFallback,
  getYoutubeStatus
};
