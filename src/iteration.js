const { tr, getLang } = require("./i18n");

function getLevels() {
  return [
    ["global", tr("iter.level.global")],
    ["brand", tr("iter.level.brand")],
    ["market", tr("iter.level.market")],
    ["channel", tr("iter.level.channel")],
    ["campaign", tr("iter.level.campaign")]
  ];
}

const LIST_FIELDS = [
  "requiredElements",
  "bannedClaims",
  "visualRules",
  "offerRules",
  "complianceNotes",
  "audiences"
];

const SCALAR_FIELDS = ["objective", "tone", "landingPage", "primaryKpi"];

function getDefaultHierarchy() {
  return {
    global: {
      objective: tr("iter.objective"),
      tone: tr("iter.tone"),
      primaryKpi: "ROAS",
      requiredElements: tr("iter.default.global.required"),
      bannedClaims: tr("iter.default.global.banned"),
      visualRules: tr("iter.default.global.visual"),
      offerRules: tr("iter.default.global.offer"),
      complianceNotes: tr("iter.default.global.compliance")
    },
    brand: {
      requiredElements: tr("iter.default.brand.required"),
      visualRules: tr("iter.default.brand.visual")
    },
    market: {
      requiredElements: tr("iter.default.market.required"),
      bannedClaims: tr("iter.default.market.banned"),
      offerRules: tr("iter.default.market.offer")
    },
    channel: {
      visualRules: tr("iter.default.channel.visual"),
      complianceNotes: tr("iter.default.channel.compliance")
    },
    campaign: {
      requiredElements: tr("iter.default.campaign.required"),
      offerRules: tr("iter.default.campaign.offer")
    }
  };
}

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
  const hierarchy = mergeHierarchy(getDefaultHierarchy(), input.hierarchy || {});
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
  for (const [key] of getLevels()) {
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

  for (const [level] of getLevels()) {
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
  return getLevels().map(([key, label]) => {
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
      title: tr("iter.signal.scale.title", { angle: row.angle }),
      detail: tr("iter.signal.scale.detail", {
        platform: row.platform,
        campaign: row.campaign,
        score: row.score
      }),
      priority: "High"
    })),
    ...lowHookRows.slice(0, 2).map(row => ({
      type: "hook_gap",
      creativeId: row.creativeId,
      title: tr("iter.signal.hook.title"),
      detail: tr("iter.signal.hook.detail", {
        angle: row.angle,
        ctr: roundRate(row.ctr),
        avg: roundRate(benchmarks.ctr)
      }),
      priority: "High"
    })),
    ...landingGapRows.slice(0, 2).map(row => ({
      type: "landing_gap",
      creativeId: row.creativeId,
      title: tr("iter.signal.cvr.title"),
      detail: tr("iter.signal.cvr.detail", { angle: row.angle, cvr: roundRate(row.cvr) }),
      priority: "Medium"
    })),
    ...risks.map(row => ({
      type: "risk",
      creativeId: row.creativeId,
      title: tr("iter.signal.rebuild.title"),
      detail: tr("iter.signal.rebuild.detail", {
        platform: row.platform,
        campaign: row.campaign,
        roas: roundNumber(row.roas)
      }),
      priority: "Medium"
    }))
  ].slice(0, 8);
}

function buildBacklog({ rows, signals, effectiveRequirements, trends, ads }) {
  const winners = rows.filter(row => row.score >= 100).sort((left, right) => right.score - left.score);
  const gaps = rows.filter(row => row.score < 100).sort((left, right) => left.score - right.score);
  const topTrend = trends[0]?.name || winners[0]?.angle || tr("iter.fallback.angle");
  const topAd = ads[0]?.headline || winners[0]?.hook || tr("iter.fallback.creative");
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
        problem: tr("iter.brief.scale.problem"),
        hypothesis: tr("iter.brief.scale.hypothesis", { angle: row.angle }),
        actions: tr("iter.brief.scale.actions"),
        metric: tr("iter.brief.scale.metric")
      })
    ),
    ...gaps.slice(0, 3).map((row, index) =>
      createBrief({
        index: index + 2,
        row,
        priority: index === 0 ? "P0" : "P1",
        problem: row.ctr < 0.015 ? tr("iter.brief.ctr.problem") : tr("iter.brief.cvr.problem"),
        hypothesis:
          row.ctr < 0.015
            ? tr("iter.brief.ctr.hypothesis", { trend: topTrend })
            : tr("iter.brief.cvr.hypothesis"),
        actions: row.ctr < 0.015 ? tr("iter.brief.ctr.actions") : tr("iter.brief.cvr.actions"),
        metric: row.ctr < 0.015 ? tr("iter.brief.ctr.metric") : tr("iter.brief.cvr.metric")
      })
    ),
    createBrief({
      index: 5,
      row: rows[0],
      priority: "P1",
      problem: tr("iter.brief.inherit.problem"),
      hypothesis: tr("iter.brief.inherit.hypothesis", { ad: topAd }),
      actions: tr("iter.brief.inherit.actions"),
      metric: tr("iter.brief.inherit.metric")
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
  const separator = getLang() === "zh" ? "、" : ", ";
  return [
    tr("iter.prompt.line1", { platform: brief.platform }),
    tr("iter.prompt.line2", { objective: requirements.objective || tr("iter.objectiveFallback") }),
    tr("iter.prompt.line3", { tone: requirements.tone || tr("iter.toneFallback") }),
    tr("iter.prompt.line4", { angle: brief.angle }),
    tr("iter.prompt.line5", { items: requirements.requiredElements.slice(0, 6).join(separator) }),
    tr("iter.prompt.line6", { items: requirements.bannedClaims.slice(0, 5).join(separator) }),
    tr("iter.prompt.line7")
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
