const state = {
  report: null,
  iteration: null,
  filter: "all"
};

const creativeFallbacks = {
  meta: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
  google: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
  bing: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80"
};

const form = document.querySelector("#intelForm");
const statusBanner = document.querySelector("#statusBanner");
const adsGrid = document.querySelector("#adsGrid");
const competitorList = document.querySelector("#competitorList");
const trendList = document.querySelector("#trendList");
const sourceList = document.querySelector("#sourceList");
const requirementList = document.querySelector("#requirementList");
const signalList = document.querySelector("#signalList");
const iterationSummary = document.querySelector("#iterationSummary");
const backlogList = document.querySelector("#backlogList");
const adTemplate = document.querySelector("#adCardTemplate");
const runButton = document.querySelector(".run-button");
const iterationForm = document.querySelector("#iterationForm");
const iterationButton = document.querySelector("#iterationButton");
const sampleCsvButton = document.querySelector("#sampleCsvButton");
const csvFile = document.querySelector("#csvFile");

const sampleCsv = [
  "creative_id,platform,campaign,angle,hook,impressions,clicks,spend,conversions,revenue,thumb_stop_rate,hold_rate",
  "meta-hook-001,Meta,US Patio Prospecting,Fast shipping promise,Ship your backyard upgrade this week,82000,1640,2460,82,10660,0.31,0.18",
  "google-rsa-017,Google,Search Garage Storage,Garage organization,Heavy-duty storage for weekend projects,45000,1260,1890,54,7560,,",
  "meta-offer-009,Meta,CA Bundle Offer,Bundle discount,Save more when you build the full set,61000,671,1640,18,2700,0.19,0.08"
].join("\n");

form.addEventListener("submit", event => {
  event.preventDefault();
  runIntel();
});

iterationForm.addEventListener("submit", event => {
  event.preventDefault();
  runIteration();
});

sampleCsvButton.addEventListener("click", () => {
  document.querySelector("#platformCsv").value = state.iteration?.sampleCsv || sampleCsv;
  runIteration();
});

csvFile.addEventListener("change", async () => {
  const file = csvFile.files?.[0];
  if (!file) return;
  document.querySelector("#platformCsv").value = await file.text();
  runIteration();
});

document.querySelectorAll(".segment").forEach(button => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".segment").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderAds();
  });
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    const section = button.dataset.section;
    const target =
      section === "ads"
        ? adsGrid
        : section === "trends"
          ? trendList
          : section === "iteration"
            ? document.querySelector('[data-panel="iteration"]')
            : section === "sources"
              ? sourceList
              : document.querySelector(".metric-grid");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

loadSourceStatus();
runIntel();

async function runIntel() {
  const website = document.querySelector("#websiteInput").value.trim();
  const markets = document.querySelector("#marketSelect").value.split(",");
  const sinceDays = Number(document.querySelector("#sinceDays").value);
  const platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map(item => item.value);

  setLoading(true);
  setStatus("Scanning", "正在拉取广告透明度中心数据，并生成竞品趋势信号。");

  try {
    const response = await fetch("/api/intel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ website, markets, sinceDays, platforms })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "request_failed");
    }

    state.report = await response.json();
    renderReport();
    runIteration();
    setStatus(
      state.report.sourceMode === "demo" ? "Demo mode" : "Live mixed",
      `${state.report.query.domain} 已完成分析，当前返回 ${state.report.ads.length} 条广告素材。`
    );
  } catch (error) {
    setStatus("Error", `无法完成拉取：${error.message}`);
  } finally {
    setLoading(false);
  }
}

async function loadSourceStatus() {
  const response = await fetch("/api/source-status");
  const status = await response.json();
  renderSources(status);
}

function renderReport() {
  const { summary } = state.report;
  document.querySelector("#metricAds").textContent = summary.adsFound;
  document.querySelector("#metricHot").textContent = summary.hotAds;
  document.querySelector("#metricCompetitors").textContent = summary.competitorsFound;
  document.querySelector("#metricTrends").textContent = summary.trendsFound;
  document.querySelector("#metricAngle").textContent = summary.topAngle;
  document.querySelector("#modeLabel").textContent = state.report.sourceMode === "demo" ? "Demo mode" : "Live mixed";
  document.querySelector("#modeHint").textContent = state.report.warnings.at(-1)?.message || "Connector ready";

  renderAds();
  renderCompetitors();
  renderTrends();
  renderSources(state.report.sourceStatus);
}

async function runIteration() {
  setIterationLoading(true);

  try {
    const hierarchy = buildHierarchyInput();
    const response = await fetch("/api/iteration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hierarchy,
        platformCsv: document.querySelector("#platformCsv").value,
        ads: state.report?.ads || [],
        trends: state.report?.trends || []
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || "iteration_failed");
    }

    state.iteration = await response.json();
    renderIteration();
  } catch (error) {
    requirementList.innerHTML = `<div class="empty-state">无法生成迭代：${escapeHtml(error.message)}</div>`;
  } finally {
    setIterationLoading(false);
  }
}

function renderAds() {
  const ads = state.report?.ads || [];
  const filtered = state.filter === "all" ? ads : ads.filter(ad => ad.platform === state.filter);
  adsGrid.innerHTML = "";

  if (!filtered.length) {
    adsGrid.innerHTML = '<div class="empty-state">当前筛选没有广告素材。</div>';
    return;
  }

  filtered.forEach(ad => {
    const node = adTemplate.content.cloneNode(true);
    const image = node.querySelector("img");
    image.src = ad.imageUrl || creativeFallbacks[ad.platform] || creativeFallbacks.google;
    image.alt = `${ad.advertiser} creative`;
    image.onerror = () => {
      image.src = creativeFallbacks[ad.platform] || creativeFallbacks.google;
    };
    node.querySelector(".platform-pill").textContent = ad.platform;
    node.querySelector(".advertiser").textContent = `${ad.advertiser} · ${ad.market} · ${ad.format}`;
    node.querySelector(".heat").textContent = `Heat ${ad.heat}`;
    node.querySelector("h3").textContent = ad.headline;
    node.querySelector("p").textContent = ad.body;
    node.querySelector(".source-link").href = ad.sourceUrl || "#";
    node.querySelector(".landing-link").href = ad.landingUrl || "#";

    const tagRow = node.querySelector(".tag-row");
    ad.tags.slice(0, 3).forEach(tag => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      tagRow.append(span);
    });

    adsGrid.append(node);
  });
}

function renderCompetitors() {
  const competitors = state.report?.competitors || [];
  competitorList.innerHTML = competitors
    .map(
      competitor => `
        <article class="competitor-item">
          <div class="item-top">
            <strong>${escapeHtml(competitor.name)}</strong>
            <span class="score">${competitor.overlap}</span>
          </div>
          <div class="bar"><span style="width: ${competitor.overlap}%"></span></div>
          <p class="item-copy">${escapeHtml(competitor.domain)} · ${escapeHtml(competitor.category)}</p>
          <p class="item-copy">${escapeHtml(competitor.signal)}</p>
        </article>
      `
    )
    .join("");
}

function renderTrends() {
  const trends = state.report?.trends || [];
  trendList.innerHTML = trends
    .map(
      trend => `
        <article class="trend-item">
          <div class="item-top">
            <strong>${escapeHtml(trend.name)}</strong>
            <span class="score">${trend.growth}</span>
          </div>
          <div class="bar"><span style="width: ${trend.score}%"></span></div>
          <p class="item-copy">${escapeHtml(trend.type)} · ${escapeHtml(trend.category)} · ${escapeHtml(trend.window)}</p>
          <p class="item-copy">${escapeHtml(trend.recommendation)}</p>
        </article>
      `
    )
    .join("");
}

function renderSources(status) {
  const sources = Object.values(status || {});
  sourceList.innerHTML = sources
    .map(
      source => `
        <article class="source-item">
          <div class="item-top">
            <strong>${escapeHtml(source.label)}</strong>
            <span class="score">${source.configured ? "Live" : "Demo"}</span>
          </div>
          <p class="item-copy">${escapeHtml(source.route)} · ${escapeHtml(source.mode)} · ${escapeHtml(source.access)}</p>
          <p class="item-copy">${escapeHtml(renderMissingConfig(source))}</p>
          <a href="${source.sourceUrl}" target="_blank" rel="noreferrer">打开透明度中心</a>
        </article>
      `
    )
    .join("");
}

function renderMissingConfig(source) {
  if (!source.missing || source.missing.length === 0) {
    return source.directKey ? `${source.directKey} ready` : `${source.envKey} ready`;
  }
  return `需要配置：${source.missing.join(" 或 ")}`;
}

function renderIteration() {
  const iteration = state.iteration;
  if (!iteration) return;

  document.querySelector("#metricBacklog").textContent = iteration.backlog.length;
  document.querySelector("#metricRules").textContent = `${iteration.effectiveRequirements.requiredElements.length} 条继承规则`;

  renderRequirements(iteration.effectiveRequirements, iteration.inheritanceChain);
  renderSignals(iteration.signals);
  renderIterationSummary(iteration);
  renderBacklog(iteration.backlog);
}

function renderRequirements(requirements, chain) {
  const groups = [
    ["继承链路", chain.map(item => `${item.label} ${item.rules} 条`)],
    ["必备元素", requirements.requiredElements],
    ["禁用表述", requirements.bannedClaims],
    ["视觉规则", requirements.visualRules],
    ["优惠规则", requirements.offerRules]
  ];

  requirementList.innerHTML = groups
    .map(
      ([title, items]) => `
        <article class="requirement-group">
          <strong>${escapeHtml(title)}</strong>
          <div class="chip-list">
            ${items
              .slice(0, 8)
              .map(item => `<span class="chip">${escapeHtml(item)}</span>`)
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function renderSignals(signals) {
  signalList.innerHTML = signals
    .map(
      signal => `
        <article class="signal-item ${escapeHtml(signal.type)}">
          <div class="item-top">
            <strong>${escapeHtml(signal.title)}</strong>
            <span class="score">${escapeHtml(signal.priority)}</span>
          </div>
          <p class="item-copy">${escapeHtml(signal.creativeId)} · ${escapeHtml(signal.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderIterationSummary(iteration) {
  const summary = iteration.importedSummary;
  const benchmarks = iteration.benchmarks;
  const rows = [
    ["数据模式", iteration.sourceMode === "imported" ? "CSV imported" : "Demo data"],
    ["素材行数", summary.rows],
    ["总花费", money(summary.spend)],
    ["总转化", summary.conversions],
    ["整体 ROAS", summary.roas],
    ["最佳素材", summary.bestCreativeId],
    ["平均 CTR", percent(benchmarks.ctr)],
    ["平均 CVR", percent(benchmarks.cvr)],
    ["平均 CPA", money(benchmarks.cpa)]
  ];

  iterationSummary.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="summary-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderBacklog(backlog) {
  backlogList.innerHTML = backlog
    .map(
      brief => `
        <article class="brief-card">
          <div class="brief-head">
            <span class="priority">${escapeHtml(brief.priority)}</span>
            <div>
              <strong>${escapeHtml(brief.problem)}</strong>
              <p>${escapeHtml(brief.platform)} · ${escapeHtml(brief.campaign)} · ${escapeHtml(brief.sourceCreativeId)}</p>
            </div>
            <span class="status-pill">${escapeHtml(brief.status)}</span>
          </div>
          <p class="brief-hypothesis">${escapeHtml(brief.hypothesis)}</p>
          <div class="brief-columns">
            <div>
              <span class="column-label">执行动作</span>
              <ul>${brief.actions.map(action => `<li>${escapeHtml(action)}</li>`).join("")}</ul>
            </div>
            <div>
              <span class="column-label">继承检查</span>
              <ul>${brief.inheritedChecklist.slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </div>
          </div>
          <details>
            <summary>生成提示词</summary>
            <pre>${escapeHtml(brief.prompt)}</pre>
          </details>
          <div class="brief-foot">
            <span>${escapeHtml(brief.angle)}</span>
            <strong>${escapeHtml(brief.expectedMetric)}</strong>
          </div>
        </article>
      `
    )
    .join("");
}

function buildHierarchyInput() {
  const globalRules = splitLines(document.querySelector("#globalRules").value);
  const channelRules = splitLines(document.querySelector("#channelRules").value);
  const globalBannedRules = globalRules.filter(rule => /避免|禁用|不得|禁止|绝对/.test(rule));
  const globalOfferRules = globalRules.filter(rule => /优惠|价格|落地页|权益|门槛/.test(rule));
  const globalRequiredRules = globalRules.filter(
    rule => !globalBannedRules.includes(rule) && !globalOfferRules.includes(rule)
  );

  return {
    global: {
      requiredElements: globalRequiredRules,
      bannedClaims: globalBannedRules,
      offerRules: globalOfferRules,
      objective: "提升海外广告素材迭代效率"
    },
    market: {
      requiredElements: channelRules.filter(rule => rule.includes("本地") || rule.includes("货币"))
    },
    channel: {
      visualRules: channelRules.filter(rule => !rule.includes("本地") && !rule.includes("对照组"))
    },
    campaign: {
      offerRules: channelRules.filter(rule => rule.includes("对照组") || rule.includes("优惠"))
    }
  };
}

function splitLines(value) {
  return String(value || "")
    .split(/\n|,|，/)
    .map(item => item.trim())
    .filter(Boolean);
}

function setLoading(isLoading) {
  runButton.disabled = isLoading;
  runButton.querySelector("span:last-child").textContent = isLoading ? "拉取中" : "自动拉取";
}

function setIterationLoading(isLoading) {
  iterationButton.disabled = isLoading;
  iterationButton.querySelector("span:last-child").textContent = isLoading ? "生成中" : "生成迭代";
}

function setStatus(title, detail) {
  statusBanner.querySelector("strong").textContent = title;
  statusBanner.querySelector("span").textContent = detail;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
