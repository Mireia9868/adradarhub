const LEVELS = [
  ["global", "客户基线"],
  ["brand", "品牌"],
  ["market", "市场"],
  ["channel", "平台"],
  ["campaign", "活动"]
];

const LIST_FIELDS = [
  "requiredElements",
  "bannedClaims",
  "visualRules",
  "offerRules",
  "complianceNotes",
  "audiences"
];

const SCALAR_FIELDS = ["objective", "tone", "landingPage", "primaryKpi"];

const DEFAULT_HIERARCHY = {
  global: {
    objective: "提升海外新客转化效率",
    tone: "可信、直接、有价格锚点",
    primaryKpi: "ROAS",
    requiredElements: ["品牌名", "核心产品", "明确 CTA"],
    bannedClaims: ["绝对化第一", "未经证明的疗效", "永久最低价"],
    visualRules: ["首屏展示真实产品", "前 3 秒出现核心卖点"],
    offerRules: ["优惠必须有有效期", "价格信息与落地页一致"],
    complianceNotes: ["素材文案与目标市场广告政策一致"]
  },
  brand: {
    requiredElements: ["海外配送承诺", "售后保障"],
    visualRules: ["避免纯库存图", "保留品牌识别色"]
  },
  market: {
    requiredElements: ["本地货币或本地权益"],
    bannedClaims: ["夸大配送时效"],
    offerRules: ["按市场区分免邮门槛"]
  },
  channel: {
    visualRules: ["Meta 优先短视频首帧钩子", "Google 保持标题关键词覆盖"],
    complianceNotes: ["不同平台 CTA 与审核规范匹配"]
  },
  campaign: {
    requiredElements: ["本轮测试角度"],
    offerRules: ["每个角度至少保留一个无折扣对照组"]
  }
};

const SAMPLE_PLATFORM_ROWS = [
  {
    creativeId: "meta-hook-001",
    platform: "Meta",
    campaign: "US Patio Prospecting",
    angle: "Fast shipping promise",
    hook: "Ship your backyard upgrade this week",
    impressions: 82000,
    clicks: 1640,
    spend: 2460,
    conversions: 82,
    revenue: 10660,
    thumbStopRate: 0.31,
    holdRate: 0.18
  },
  {
    creativeId: "google-rsa-017",
    platform: "Google",
    campaign: "Search Garage Storage",
    angle: "Garage organization",
    hook: "Heavy-duty storage for weekend projects",
    impressions: 45000,
    clicks: 1260,
    spend: 1890,
    conversions: 54,
    revenue: 7560
  },
  {
    creativeId: "meta-offer-009",
    platform: "Meta",
    campaign: "CA Bundle Offer",
    angle: "Bundle discount",
    hook: "Save more when you build the full set",
    impressions: 61000,
    clicks: 671,
    spend: 1640,
    conversions: 18,
    revenue: 2700,
    thumbStopRate: 0.19,
    holdRate: 0.08
  }
];

function createIterationPlan(input = {}) {
  const hierarchy = mergeHierarchy(DEFAULT_HIERARCHY, input.hierarchy || {});
  const effectiveRequirements = inheritRequirements(hierarchy);
  const rows = normalizePlatformRows(input.platformRows || parseCsv(input.platformCsv));
  const platformRows = rows.length ? rows : normalizePlatformRows(SAMPLE_PLATFORM_ROWS);
  const benchmarks = calculateBenchmarks(platformRows);
  const signals = buildSignals(platformRows, benchmarks);
  const trends = Array.isArray(input.trends) ? input.trends : [];
  const ads = Array.isArray(input.ads) ? input.ads : [];
  const backlog = buildBacklog({
    rows: platformRows,
    signals,
    benchmarks,
    effectiveRequirements,
    trends,
    ads
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceMode: rows.length ? "imported" : "demo",
    hierarchy,
    inheritanceChain: buildInheritanceChain(hierarchy),
    effectiveRequirements,
    importedSummary: summarizeRows(platformRows, rows.length),
    benchmarks,
    signals,
    backlog,
    sampleCsv: [
      "creative_id,platform,campaign,angle,hook,impressions,clicks,spend,conversions,revenue,thumb_stop_rate,hold_rate",
      "meta-hook-001,Meta,US Patio Prospecting,Fast shipping promise,Ship your backyard upgrade this week,82000,1640,2460,82,10660,0.31,0.18"
    ].join("\n")
  };
}

function mergeHierarchy(defaults, input) {
  const merged = {};
  for (const [key] of LEVELS) {
    merged[key] = {
      ...(defaults[key] || {}),
      ...(input[key] || {})
    };
  }
  return merged;
}

function inheritRequirements(hierarchy) {
  const effective = {};
  for (const field of LIST_FIELDS) effective[field] = [];

  for (const [level] of LEVELS) {
    const node = hierarchy[level] || {};
    for (const field of LIST_FIELDS) {
      effective[field] = unique([...effective[field], ...toList(node[field])]);
    }
    for (const field of SCALAR_FIELDS) {
      if (node[field]) effective[field] = String(node[field]).trim();
    }
  }

  return effective;
}

function buildInheritanceChain(hierarchy) {
  return LEVELS.map(([key, label]) => {
    const node = hierarchy[key] || {};
    return {
      key,
      label,
      rules: LIST_FIELDS.reduce((count, field) => count + toList(node[field]).length, 0),
      objective: node.objective || "",
      tone: node.tone || ""
    };
  });
}

function normalizePlatformRows(rows) {
  return rows
    .map((row, index) => normalizePlatformRow(row, index))
    .filter(row => row.impressions > 0 || row.spend > 0);
}

function normalizePlatformRow(row, index) {
  const impressions = numberFrom(row, ["impressions", "展示", "展示量"]);
  const clicks = numberFrom(row, ["clicks", "点击", "点击量"]);
  const spend = numberFrom(row, ["spend", "cost", "花费", "消耗"]);
  const conversions = numberFrom(row, ["conversions", "purchase", "purchases", "转化", "购买"]);
  const revenue = numberFrom(row, ["revenue", "value", "gmv", "收入", "销售额"]);
  const ctr = ratioFrom(row, ["ctr", "点击率"], clicks, impressions);
  const cvr = ratioFrom(row, ["cvr", "转化率"], conversions, clicks);
  const cpa = numberFrom(row, ["cpa", "每次转化成本"]) || (conversions ? spend / conversions : 0);
  const roas = numberFrom(row, ["roas", "广告支出回报率"]) || (spend ? revenue / spend : 0);

  return {
    creativeId: textFrom(row, ["creativeId", "creative_id", "adId", "ad_id", "素材ID", "广告ID"]) || `creative-${index + 1}`,
    platform: textFrom(row, ["platform", "平台"]) || "Unknown",
    campaign: textFrom(row, ["campaign", "campaignName", "广告系列", "计划"]) || "Unassigned",
    angle: textFrom(row, ["angle", "tags", "卖点", "角度"]) || "Unlabeled angle",
    hook: textFrom(row, ["hook", "headline", "title", "钩子", "标题"]) || "",
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
    ctr,
    cvr,
    cpa,
    roas,
    thumbStopRate: ratioValue(textFrom(row, ["thumbStopRate", "thumb_stop_rate", "拇指停留率", "停留率"])),
    holdRate: ratioValue(textFrom(row, ["holdRate", "hold_rate", "完播率", "留存率"])),
    score: 0
  };
}

function calculateBenchmarks(rows) {
  const averages = {
    ctr: average(rows.map(row => row.ctr)),
    cvr: average(rows.map(row => row.cvr)),
    cpa: average(rows.map(row => row.cpa).filter(Boolean)),
    roas: average(rows.map(row => row.roas)),
    thumbStopRate: average(rows.map(row => row.thumbStopRate).filter(Boolean)),
    holdRate: average(rows.map(row => row.holdRate).filter(Boolean))
  };

  for (const row of rows) {
    const ctrIndex = indexScore(row.ctr, averages.ctr);
    const cvrIndex = indexScore(row.cvr, averages.cvr);
    const roasIndex = indexScore(row.roas, averages.roas);
    const cpaIndex = averages.cpa && row.cpa ? Math.max(20, Math.min(140, (averages.cpa / row.cpa) * 100)) : 80;
    row.score = Math.round(ctrIndex * 0.3 + cvrIndex * 0.25 + roasIndex * 0.3 + cpaIndex * 0.15);
  }

  return {
    ctr: roundRate(averages.ctr),
    cvr: roundRate(averages.cvr),
    cpa: roundMoney(averages.cpa),
    roas: roundNumber(averages.roas),
    thumbStopRate: roundRate(averages.thumbStopRate),
    holdRate: roundRate(averages.holdRate)
  };
}

function buildSignals(rows, benchmarks) {
  const winners = [...rows].sort((left, right) => right.score - left.score).slice(0, 3);
  const risks = [...rows].sort((left, right) => left.score - right.score).slice(0, 3);
  const lowHookRows = rows.filter(row => row.ctr < benchmarks.ctr || (row.thumbStopRate && row.thumbStopRate < benchmarks.thumbStopRate));
  const landingGapRows = rows.filter(row => row.ctr >= benchmarks.ctr && row.cvr < benchmarks.cvr);

  return [
    ...winners.map(row => ({
      type: "winner",
      creativeId: row.creativeId,
      title: `${row.angle} 可放量`,
      detail: `${row.platform} / ${row.campaign} 综合得分 ${row.score}，优先复制结构而不是只复制文案。`,
      priority: "High"
    })),
    ...lowHookRows.slice(0, 2).map(row => ({
      type: "hook_gap",
      creativeId: row.creativeId,
      title: "首屏钩子需要重做",
      detail: `${row.angle} CTR ${roundRate(row.ctr)}，低于导入数据均值 ${roundRate(benchmarks.ctr)}。`,
      priority: "High"
    })),
    ...landingGapRows.slice(0, 2).map(row => ({
      type: "landing_gap",
      creativeId: row.creativeId,
      title: "点击后转化承接不足",
      detail: `${row.angle} 点击达标但 CVR ${roundRate(row.cvr)}，需要同步落地页首屏与价格信息。`,
      priority: "Medium"
    })),
    ...risks.map(row => ({
      type: "risk",
      creativeId: row.creativeId,
      title: "低效素材进入重构池",
      detail: `${row.platform} / ${row.campaign} ROAS ${roundNumber(row.roas)}，建议降预算或改角度复测。`,
      priority: "Medium"
    }))
  ].slice(0, 8);
}

function buildBacklog({ rows, signals, effectiveRequirements, trends, ads }) {
  const winners = rows.filter(row => row.score >= 100).sort((left, right) => right.score - left.score);
  const gaps = rows.filter(row => row.score < 100).sort((left, right) => left.score - right.score);
  const topTrend = trends[0]?.name || winners[0]?.angle || "核心卖点";
  const topAd = ads[0]?.headline || winners[0]?.hook || "高表现素材结构";
  const checklist = [
    ...effectiveRequirements.requiredElements.slice(0, 5),
    ...effectiveRequirements.visualRules.slice(0, 3)
  ];

  const briefs = [
    ...winners.slice(0, 2).map((row, index) =>
      createBrief({
        index,
        row,
        priority: "P0",
        problem: "已有高表现素材需要规模化变体",
        hypothesis: `保留「${row.angle}」的利益点和节奏，换首帧、价格锚点与 CTA，可扩大受众覆盖。`,
        actions: ["生成 3 个首帧版本", "保留同一落地页承接", "拆分新客与再营销受众"],
        metric: "ROAS 不低于当前均值，CTR 提升 10%"
      })
    ),
    ...gaps.slice(0, 3).map((row, index) =>
      createBrief({
        index: index + 2,
        row,
        priority: index === 0 ? "P0" : "P1",
        problem: row.ctr < 0.015 ? "点击吸引力不足" : "转化效率不足",
        hypothesis:
          row.ctr < 0.015
            ? `把「${topTrend}」放进前 3 秒，并更早展示产品结果，可改善弱钩子。`
            : `同步广告承诺、价格权益与落地页首屏，可减少点击后的流失。`,
        actions:
          row.ctr < 0.015
            ? ["重写前 3 秒字幕", "增加产品使用场景", "测试问题式标题"]
            : ["核对优惠一致性", "强化信任模块", "单独测试免邮或分期权益"],
        metric: row.ctr < 0.015 ? "CTR +20%，Thumb-stop rate +15%" : "CVR +15%，CPA -10%"
      })
    ),
    createBrief({
      index: 5,
      row: rows[0],
      priority: "P1",
      problem: "客户规则需要被每轮素材稳定继承",
      hypothesis: `把「${topAd}」拆成模板，并自动附加品牌、市场、平台和活动要求，可以减少返工。`,
      actions: ["锁定必备元素检查", "生成违禁词扫描", "导出给设计与投手的 Brief"],
      metric: "素材返工率下降，审核失败率下降"
    })
  ];

  return briefs.map(brief => ({
    ...brief,
    inheritedChecklist: checklist,
    prompt: buildCreativePrompt(brief, effectiveRequirements)
  }));
}

function createBrief({ index, row, priority, problem, hypothesis, actions, metric }) {
  return {
    id: `iter-${String(index + 1).padStart(2, "0")}`,
    priority,
    sourceCreativeId: row?.creativeId || "rule-template",
    platform: row?.platform || "All",
    campaign: row?.campaign || "Rule inheritance",
    angle: row?.angle || "Inherited creative requirements",
    problem,
    hypothesis,
    actions,
    expectedMetric: metric,
    status: priority === "P0" ? "Ready for production" : "Queue"
  };
}

function buildCreativePrompt(brief, requirements) {
  return [
    `为 ${brief.platform} 生成广告素材迭代方案。`,
    `目标：${requirements.objective || "提升广告效率"}。`,
    `语气：${requirements.tone || "清晰可信"}。`,
    `角度：${brief.angle}。`,
    `必须包含：${requirements.requiredElements.slice(0, 6).join("、")}。`,
    `避免：${requirements.bannedClaims.slice(0, 5).join("、")}。`,
    `输出：3 个标题、3 个首屏脚本、1 个设计 Brief、1 个落地页承接建议。`
  ].join("\n");
}

function summarizeRows(rows, importedCount) {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    rows: rows.length,
    importedRows: importedCount,
    spend: roundMoney(spend),
    conversions: roundNumber(conversions),
    revenue: roundMoney(revenue),
    roas: roundNumber(spend ? revenue / spend : 0),
    bestCreativeId: [...rows].sort((left, right) => right.score - left.score)[0]?.creativeId || ""
  };
}

function parseCsv(csv) {
  const text = String(csv || "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function numberFrom(row, keys) {
  return Number(cleanNumber(textFrom(row, keys))) || 0;
}

function ratioFrom(row, keys, numerator, denominator) {
  const raw = ratioValue(textFrom(row, keys));
  if (raw) return raw;
  return denominator ? numerator / denominator : 0;
}

function ratioValue(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const number = Number(cleanNumber(text));
  if (!Number.isFinite(number)) return 0;
  return text.includes("%") ? number / 100 : number;
}

function textFrom(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

function cleanNumber(value) {
  return String(value || "").replace(/[$,%\s]/g, "");
}

function toList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\n|,|，/)
    .map(item => item.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function average(values) {
  const cleanValues = values.filter(value => Number.isFinite(value) && value > 0);
  if (!cleanValues.length) return 0;
  return cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length;
}

function indexScore(value, benchmark) {
  if (!benchmark || !value) return 80;
  return Math.max(20, Math.min(160, (value / benchmark) * 100));
}

function roundRate(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundNumber(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  createIterationPlan
};
