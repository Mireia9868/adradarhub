const state = {
  report: null,
  iteration: null,
  filter: "all"
};

// 广告展示优先级：Bing（可抓取真实数据）在前，Meta / Google 在后。
// 后端 /api/intel 已按此顺序返回，这里兜一层，避免直接消费旧数据时顺序被打乱。
const PLATFORM_ORDER = { bing: 0, meta: 1, google: 2 };

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
const genForm = document.querySelector("#genForm");
const genButton = document.querySelector("#genButton");
const genPrompt = document.querySelector("#genPrompt");
const genNegative = document.querySelector("#genNegative");
const genSize = document.querySelector("#genSize");
const genResults = document.querySelector("#genResults");
const genStatus = document.querySelector("#genStatus");
const dsIdea = document.querySelector("#dsIdea");
const dsPlatform = document.querySelector("#dsPlatform");
const dsSize = document.querySelector("#dsSize");
const dsButton = document.querySelector("#dsButton");
const dsOutput = document.querySelector("#dsOutput");
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

genForm.addEventListener("submit", event => {
  event.preventDefault();
  runGenerate();
});

dsButton.addEventListener("click", runDeepSeek);

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
    // 一项菜单 = 一个功能页
    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.dataset.page === section);
    });
    if (history.replaceState) history.replaceState(null, "", "#" + section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// 支持 #hash 直达对应功能页（如 #ads / #iteration）
const initialSection = (location.hash || "").replace("#", "");
if (initialSection) {
  const navButton = document.querySelector(`.nav-item[data-section="${initialSection}"]`);
  if (navButton) navButton.click();
}

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

async function runDeepSeek() {
  const idea = dsIdea.value.trim();
  if (!idea) {
    dsOutput.hidden = false;
    dsOutput.innerHTML = '<div class="empty-state">请先输入粗略想法或核心卖点。</div>';
    return;
  }
  const platform = dsPlatform.value;
  const size = dsSize.value;

  dsButton.disabled = true;
  dsButton.querySelector("span:last-child").textContent = "生成中…";
  dsOutput.hidden = false;
  dsOutput.innerHTML = '<div class="empty-state">DeepSeek 正在撰写提示词与文案，约 5–20 秒…</div>';

  try {
    const system =
      "你是资深海外广告创意总监，擅长把简短卖点扩写成可直接用于文生图模型的提示词以及配套广告文案。输出结构清晰、可直接复制。";
    const prompt = [
      `产品 / 卖点：${idea}`,
      `目标平台：${platform}`,
      `计划生成的画面比例：${size}`,
      "",
      "请使用 Markdown 输出以下内容：",
      "1. **文生图提示词（中文，给 Qwen 用）**：在此冒号后直接写提示词，含主体、场景、光线、构图、色调、留白，控制在 80 字以内。",
      "2. **英文提示词（English prompt）**：上面中文提示词的英文版，给海外模型使用。",
      "3. **广告文案**：3 个标题（含钩子）+ 1 句主文案 + 1 个 CTA。",
      "4. **风格与避坑**：1-2 句该平台素材应注意的视觉与合规要点。"
    ].join("\n");

    const response = await fetch("/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system, prompt, model: "deepseek-v4-flash", temperature: 0.8 })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || "生成失败");
    }

    const cnPrompt = extractCnPrompt(data.text);
    dsOutput.innerHTML = `
      <div class="ds-result-head">
        <strong>DeepSeek 生成结果</strong>
        <button class="ghost-button" id="useDsPrompt" type="button">用此提示词生成图片 →</button>
      </div>
      <pre class="ds-markdown">${escapeHtml(data.text)}</pre>
    `;
    document.querySelector("#useDsPrompt").addEventListener("click", () => {
      genPrompt.value = cnPrompt || idea;
      genSize.value = size;
      runGenerate();
    });
  } catch (error) {
    dsOutput.innerHTML = `<div class="empty-state">生成失败：${escapeHtml(error.message)}</div>`;
  } finally {
    dsButton.disabled = false;
    dsButton.querySelector("span:last-child").textContent = "DeepSeek 生成提示词+文案";
  }
}

function extractCnPrompt(text) {
  const match = String(text || "").match(/文生图提示词（中文[^\n]*?[:：]\s*([^\n]+)/);
  if (match) {
    return match[1].trim().replace(/^[\s>*#\-]+/, "");
  }
  return "";
}

async function runGenerate() {
  const prompt = genPrompt.value.trim();
  if (!prompt) {
    genStatus.textContent = "请先输入提示词";
    genResults.innerHTML = '<div class="empty-state">输入提示词后再生成。</div>';
    return;
  }

  genButton.disabled = true;
  genButton.querySelector("span:last-child").textContent = "生成中…";
  genStatus.textContent = "Qwen 正在生成，约 10–40 秒";
  genResults.innerHTML = '<div class="empty-state">生成中，请稍候…</div>';

  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        negativePrompt: genNegative.value.trim(),
        size: genSize.value
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || "生成失败");
    }

    genResults.innerHTML = data.images
      .map(
        url => `
        <figure class="gen-card">
          <img src="${escapeHtml(url)}" alt="生成素材" loading="lazy" />
          <figcaption><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">打开原图</a></figcaption>
        </figure>`
      )
      .join("");
    genStatus.textContent = `完成，已生成 ${data.images.length} 张`;
  } catch (error) {
    genStatus.textContent = "生成失败";
    genResults.innerHTML = `<div class="empty-state">生成失败：${escapeHtml(error.message)}</div>`;
  } finally {
    genButton.disabled = false;
    genButton.querySelector("span:last-child").textContent = "生成素材";
  }
}

function renderAds() {
  const ads = state.report?.ads || [];
  const sorted = [...ads].sort((a, b) => {
    const pa = PLATFORM_ORDER[a.platform] ?? 3;
    const pb = PLATFORM_ORDER[b.platform] ?? 3;
    if (pa !== pb) return pa - pb;
    return (b.heat ?? 0) - (a.heat ?? 0);
  });
  const filtered = state.filter === "all" ? sorted : sorted.filter(ad => ad.platform === state.filter);
  adsGrid.innerHTML = "";

  if (!filtered.length) {
    adsGrid.innerHTML = '<div class="empty-state">当前筛选没有广告素材。</div>';
    return;
  }

  filtered.forEach(ad => {
    const node = adTemplate.content.cloneNode(true);
    const creative = node.querySelector(".ad-creative");
    const image = node.querySelector("img");
    if (ad.imageUrl) {
      image.src = ad.imageUrl;
      image.alt = `${ad.advertiser} creative`;
      image.onerror = () => {
        image.remove();
        creative.classList.add("no-image");
        creative.dataset.placeholder = ad.headline || "无图片素材";
      };
    } else {
      // 该广告没有图片素材，不再套用示例图，改用文字占位
      image.remove();
      creative.classList.add("no-image");
      creative.dataset.placeholder = ad.headline || "无图片素材";
    }
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
