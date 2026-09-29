const state = {
  report: null,
  iteration: null,
  site: null,
  filter: "all"
};

// 广告展示优先级：Bing（可抓取真实数据）在前，Meta / Google 在后。
// 后端 /api/intel 已按此顺序返回，这里兜一层，避免直接消费旧数据时顺序被打乱。
const PLATFORM_ORDER = { bing: 0, youtube: 1, tiktok: 2, meta: 3, google: 4 };

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
const siteForm = document.querySelector("#siteForm");
const siteButton = document.querySelector("#siteButton");
const siteMode = document.querySelector("#siteMode");
const siteNote = document.querySelector("#siteNote");
const gscSummary = document.querySelector("#gscSummary");
const gscQueries = document.querySelector("#gscQueries");
const gscOpportunities = document.querySelector("#gscOpportunities");
const ga4Summary = document.querySelector("#ga4Summary");
const ga4Channels = document.querySelector("#ga4Channels");
const ga4Pages = document.querySelector("#ga4Pages");
const siteInsights = document.querySelector("#siteInsights");
const gscRange = document.querySelector("#gscRange");
const ga4Range = document.querySelector("#ga4Range");

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

siteForm.addEventListener("submit", event => {
  event.preventDefault();
  runSiteAnalytics();
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
    // 一项菜单 = 一个功能页
    document.querySelectorAll(".page").forEach(page => {
      page.classList.toggle("active", page.dataset.page === section);
    });
    if (history.replaceState) history.replaceState(null, "", "#" + section);
    // 首次进入「站点数据」自动拉一次，避免空页面。
    if (section === "site" && !state.site) runSiteAnalytics();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// 支持 #hash 直达对应功能页（如 #ads / #iteration）
const initialSection = (location.hash || "").replace("#", "");
if (initialSection) {
  const navButton = document.querySelector(`.nav-item[data-section="${initialSection}"]`);
  if (navButton) navButton.click();
}

// ===== 账号、会话与每日配额 =====
const auth = { enabled: false, token: "", user: null, usage: null };
const TOKEN_KEY = "atr_token";

const authBar = document.querySelector("#authBar");
const authUser = document.querySelector("#authUser");
const authOpen = document.querySelector("#authOpen");
const authLogout = document.querySelector("#authLogout");
const authEmailLabel = document.querySelector("#authEmailLabel");
const authQuota = document.querySelector("#authQuota");
const authAvatar = document.querySelector("#authAvatar");
const authOverlay = document.querySelector("#authOverlay");
const authClose = document.querySelector("#authClose");
const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authError = document.querySelector("#authError");
const authSubmit = document.querySelector("#authSubmit");
const authSubmitLabel = document.querySelector("#authSubmitLabel");
const authTitle = document.querySelector("#authTitle");
const authSub = document.querySelector("#authSub");
const tabLogin = document.querySelector("#tabLogin");
const tabSignup = document.querySelector("#tabSignup");

let authMode = "login";

function renderAuth() {
  if (!auth.enabled) {
    authBar.hidden = true;
    return;
  }
  authBar.hidden = false;
  if (auth.user) {
    authUser.hidden = false;
    authOpen.hidden = true;
    authEmailLabel.textContent = auth.user.email;
    authAvatar.textContent = (auth.user.email || "U").charAt(0).toUpperCase();
    applyUsage(auth.usage);
  } else {
    authUser.hidden = true;
    authOpen.hidden = false;
  }
}

function applyUsage(usage) {
  if (!usage) return;
  auth.usage = { ...auth.usage, ...usage };
  authQuota.textContent = auth.usage.remaining > 0 ? t("auth.quota", { n: auth.usage.remaining }) : t("auth.quotaEmpty");
  authQuota.classList.toggle("is-empty", auth.usage.remaining <= 0);
}

function openAuthModal() {
  authOverlay.hidden = false;
  setTimeout(() => authEmail.focus(), 30);
}

function closeAuthModal() {
  authOverlay.hidden = true;
  authError.hidden = true;
}

function setAuthMode(mode) {
  authMode = mode;
  tabLogin.classList.toggle("active", mode === "login");
  tabSignup.classList.toggle("active", mode === "signup");
  authTitle.textContent = mode === "login" ? t("auth.titleLogin") : t("auth.titleSignup");
  authSub.textContent = mode === "login" ? t("auth.subLogin") : t("auth.subSignup");
  authSubmitLabel.textContent = mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup");
  authError.hidden = true;
}

// 统一带 Authorization 的请求，并集中处理未登录 / 额度耗尽
async function requestWithAuth(pathname, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  const separator = pathname.includes("?") ? "&" : "?";
  const response = await fetch(`${pathname}${separator}lang=${ATR_LANG}`, { ...options, headers });

  const remaining = response.headers.get("x-quota-remaining");
  if (remaining !== null) {
    applyUsage({
      remaining: Number(remaining),
      used: Number(response.headers.get("x-quota-used") || 0),
      limit: Number(response.headers.get("x-quota-limit") || 10)
    });
  }

  if (response.status === 401 && auth.enabled) {
    auth.token = "";
    auth.user = null;
    localStorage.removeItem(TOKEN_KEY);
    renderAuth();
    openAuthModal();
    throw new Error(t("auth.needLogin"));
  }
  if (response.status === 429) {
    const data = await response.json().catch(() => ({}));
    applyUsage({ remaining: 0 });
    throw new Error(data.error || data.message || t("auth.quotaEmpty"));
  }
  return response;
}

async function fetchMe() {
  try {
    const response = await fetch("/api/auth/me", {
      headers: auth.token ? { authorization: `Bearer ${auth.token}` } : {}
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data.user) return false;
    auth.user = data.user;
    auth.usage = data.usage;
    return true;
  } catch (error) {
    return false;
  }
}

async function initAuth() {
  try {
    const response = await fetch("/api/auth/config");
    const cfg = await response.json();
    auth.enabled = Boolean(cfg.enabled);
  } catch (error) {
    auth.enabled = false;
  }
  renderAuth();
  if (!auth.enabled) return true;

  auth.token = localStorage.getItem(TOKEN_KEY) || "";
  if (auth.token && (await fetchMe())) {
    renderAuth();
    return true;
  }
  auth.token = "";
  auth.user = null;
  localStorage.removeItem(TOKEN_KEY);
  renderAuth();
  openAuthModal();
  return false;
}

async function submitAuth(event) {
  event.preventDefault();
  authError.hidden = true;
  authSubmit.disabled = true;
  authSubmitLabel.textContent = authMode === "login" ? t("auth.submitLoginLoading") : t("auth.submitSignupLoading");
  try {
    const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: authEmail.value.trim(), password: authPassword.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || t("auth.loginFailed"));
    localStorage.setItem(TOKEN_KEY, data.token);
    auth.token = data.token;
    auth.user = data.user;
    auth.usage = data.usage;
    renderAuth();
    closeAuthModal();
    runIntel();
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
    authSubmitLabel.textContent = authMode === "login" ? t("auth.submitLogin") : t("auth.submitSignup");
  }
}

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  auth.token = "";
  auth.user = null;
  auth.usage = null;
  renderAuth();
  openAuthModal();
}

if (authOpen) authOpen.addEventListener("click", () => openAuthModal());
if (authLogout) authLogout.addEventListener("click", handleLogout);
if (authClose) authClose.addEventListener("click", closeAuthModal);
if (authOverlay) {
  authOverlay.addEventListener("click", event => {
    if (event.target === authOverlay) closeAuthModal();
  });
}
if (tabLogin) tabLogin.addEventListener("click", () => setAuthMode("login"));
if (tabSignup) tabSignup.addEventListener("click", () => setAuthMode("signup"));
if (authForm) authForm.addEventListener("submit", submitAuth);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAuthModal();
});

// 切语言后重跑所有动态渲染，避免页面残留上一语言
window.onLangChange = () => {
  setLoading(false);
  setIterationLoading(false);
  genButton.querySelector("span:last-child").textContent = t("gen.run");
  dsButton.querySelector("span:last-child").textContent = t("gen.dsRun");
  siteButton.querySelector("span:last-child").textContent = t("site.run");
  if (state.report) {
    renderReport();
    setStatus(
      state.report.sourceMode === "demo" ? t("mode.demo") : t("mode.live"),
      t("query.done", { domain: state.report.query.domain, n: state.report.ads.length })
    );
  } else {
    setStatus(t("status.ready"), t("status.readyDesc"));
  }
  if (state.report) runIteration();
  else if (state.iteration) renderIteration();
  if (state.site) reloadSiteForLang();
  else siteNote.textContent = t("site.note");
  loadSourceStatus();
  renderAuth();
  setAuthMode(authMode);
};

// 切语言后重拉站点数据：走 GET（不计配额），拿不到就保留上一份
async function reloadSiteForLang() {
  const params = new URLSearchParams({
    lang: ATR_LANG,
    website: document.querySelector("#siteWebsite").value.trim(),
    siteUrl: document.querySelector("#siteUrlInput").value.trim(),
    propertyId: document.querySelector("#ga4PropertyInput").value.trim(),
    sinceDays: String(Number(document.querySelector("#siteSinceDays").value))
  });
  try {
    const response = await fetch(`/api/site-analytics?${params.toString()}`);
    if (!response.ok) return;
    state.site = await response.json();
    renderSite();
  } catch (error) {
    renderSite();
  }
}

initLangSwitch();
loadSourceStatus();
initAuth().then(signedIn => {
  if (signedIn) {
    runIntel();
  } else {
    setStatus(t("status.loginRequired"), t("auth.loginRequired"));
  }
});

async function runIntel() {
  const website = document.querySelector("#websiteInput").value.trim();
  const markets = document.querySelector("#marketSelect").value.split(",");
  const sinceDays = Number(document.querySelector("#sinceDays").value);
  const platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map(item => item.value);

  setLoading(true);
  setStatus(t("query.running"), t("query.scanning"));

  try {
    const response = await requestWithAuth("/api/intel", {
      method: "POST",
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
      state.report.sourceMode === "demo" ? t("mode.demo") : t("mode.live"),
      t("query.done", { domain: state.report.query.domain, n: state.report.ads.length })
    );
  } catch (error) {
    setStatus(t("status.error"), t("query.runError", { msg: error.message }));
  } finally {
    setLoading(false);
  }
}

async function loadSourceStatus() {
  const response = await fetch(`/api/source-status?lang=${ATR_LANG}`);
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
  document.querySelector("#modeHint").textContent =
    state.report.warnings.at(-1)?.message || t("mode.ready");

  renderAds();
  renderCompetitors();
  renderTrends();
  renderSources(state.report.sourceStatus);
}

async function runIteration() {
  setIterationLoading(true);

  try {
    const hierarchy = buildHierarchyInput();
    const response = await fetch(`/api/iteration?lang=${ATR_LANG}`, {
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
    requirementList.innerHTML = `<div class="empty-state">${escapeHtml(t("iter.failed", { msg: error.message }))}</div>`;
  } finally {
    setIterationLoading(false);
  }
}

async function runDeepSeek() {
  const idea = dsIdea.value.trim();
  if (!idea) {
    dsOutput.hidden = false;
    dsOutput.innerHTML = `<div class="empty-state">${escapeHtml(t("gen.dsEmpty"))}</div>`;
    return;
  }
  const platform = dsPlatform.value;
  const size = dsSize.value;

  dsButton.disabled = true;
  dsButton.querySelector("span:last-child").textContent = t("gen.dsRunning");
  dsOutput.hidden = false;
  dsOutput.innerHTML = `<div class="empty-state">${escapeHtml(t("gen.dsWaiting"))}</div>`;

  try {
    const isZh = ATR_LANG === "zh";
    const system = isZh
      ? "你是资深海外广告创意总监，擅长把简短卖点扩写成可直接用于文生图模型的提示词以及配套广告文案。输出结构清晰、可直接复制。"
      : "You are a senior overseas advertising creative director. Turn a short selling point into a ready-to-use text-to-image prompt plus matching ad copy. Output must be structured and copy-paste ready.";
    const prompt = isZh
      ? [
          `产品 / 卖点：${idea}`,
          `目标平台：${platform}`,
          `计划生成的画面比例：${size}`,
          "",
          "请使用 Markdown 输出以下内容：",
          "1. **文生图提示词（中文，给 Qwen 用）**：在此冒号后直接写提示词，含主体、场景、光线、构图、色调、留白，控制在 80 字以内。",
          "2. **英文提示词（English prompt）**：上面中文提示词的英文版，给海外模型使用。",
          "3. **广告文案**：3 个标题（含钩子）+ 1 句主文案 + 1 个 CTA。",
          "4. **风格与避坑**：1-2 句该平台素材应注意的视觉与合规要点。"
        ].join("\n")
      : [
          `Product / selling point: ${idea}`,
          `Target platform: ${platform}`,
          `Planned aspect ratio: ${size}`,
          "",
          "Output the following in Markdown:",
          "1. **Image prompt (English, for the image model)**: write the prompt right after this colon. Include subject, scene, lighting, composition, color tone and whitespace. Keep it under 60 words.",
          "2. **Ad copy**: 3 headlines (with hooks) + 1 primary text + 1 CTA.",
          "3. **Style & pitfalls**: 1-2 sentences on visual and compliance notes for this platform."
        ].join("\n");

    const response = await requestWithAuth("/api/llm", {
      method: "POST",
      body: JSON.stringify({ system, prompt, model: "deepseek-v4-flash", temperature: 0.8 })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || t("gen.statusFailed"));
    }

    const cnPrompt = extractCnPrompt(data.text);
    dsOutput.innerHTML = `
      <div class="ds-result-head">
        <strong>${escapeHtml(t("gen.dsResult"))}</strong>
        <button class="ghost-button" id="useDsPrompt" type="button">${escapeHtml(t("gen.dsUse"))}</button>
      </div>
      <pre class="ds-markdown">${escapeHtml(data.text)}</pre>
    `;
    document.querySelector("#useDsPrompt").addEventListener("click", () => {
      genPrompt.value = cnPrompt || idea;
      genSize.value = size;
      runGenerate();
    });
  } catch (error) {
    dsOutput.innerHTML = `<div class="empty-state">${escapeHtml(t("gen.dsFailed", { msg: error.message }))}</div>`;
  } finally {
    dsButton.disabled = false;
    dsButton.querySelector("span:last-child").textContent = t("gen.dsRun");
  }
}

function extractCnPrompt(text) {
  const raw = String(text || "");
  const cn = raw.match(/文生图提示词（中文[^\n]*?[:：]\s*([^\n]+)/);
  if (cn) return cn[1].trim().replace(/^[\s>*#\-]+/, "");
  const en = raw.match(/\*\*Image prompt[^\n]*?\*\*[^\n]*?[:：]\s*([^\n]+)/i);
  if (en) return en[1].trim().replace(/^[\s>*#\-]+/, "");
  return "";
}

async function runGenerate() {
  const prompt = genPrompt.value.trim();
  if (!prompt) {
    genStatus.textContent = t("gen.emptyPrompt");
    genResults.innerHTML = `<div class="empty-state">${escapeHtml(t("gen.needPrompt"))}</div>`;
    return;
  }

  genButton.disabled = true;
  genButton.querySelector("span:last-child").textContent = t("gen.running");
  genStatus.textContent = t("gen.statusRunning");
  genResults.innerHTML = `<div class="empty-state">${escapeHtml(t("gen.statusWaiting"))}</div>`;

  try {
    const response = await requestWithAuth("/api/generate-image", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        negativePrompt: genNegative.value.trim(),
        size: genSize.value
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || t("gen.statusFailed"));
    }

    genResults.innerHTML = data.images
      .map(
        url => `
        <figure class="gen-card">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(t("gen.run"))}" loading="lazy" />
          <figcaption><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(t("gen.openOriginal"))}</a></figcaption>
        </figure>`
      )
      .join("");
    genStatus.textContent = t("gen.statusDone", { n: data.images.length });
  } catch (error) {
    genStatus.textContent = t("gen.statusFailed");
    genResults.innerHTML = `<div class="empty-state">${escapeHtml(t("gen.failed", { msg: error.message }))}</div>`;
  } finally {
    genButton.disabled = false;
    genButton.querySelector("span:last-child").textContent = t("gen.run");
  }
}

async function runSiteAnalytics() {
  const label = siteButton.querySelector("span:last-child");
  const original = label.textContent;
  siteButton.disabled = true;
  label.textContent = t("site.running");
  siteNote.textContent = t("site.pulling");

  try {
    const response = await requestWithAuth("/api/site-analytics", {
      method: "POST",
      body: JSON.stringify({
        website: document.querySelector("#siteWebsite").value.trim(),
        siteUrl: document.querySelector("#siteUrlInput").value.trim(),
        propertyId: document.querySelector("#ga4PropertyInput").value.trim(),
        sinceDays: Number(document.querySelector("#siteSinceDays").value)
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || "site_analytics_failed");

    state.site = data;
    renderSite();
  } catch (error) {
    siteNote.textContent = t("site.failed", { msg: error.message });
    siteInsights.innerHTML = `<div class="empty-state">${escapeHtml(t("site.failed", { msg: error.message }))}</div>`;
  } finally {
    siteButton.disabled = false;
    label.textContent = original;
  }
}

function renderSite() {
  const data = state.site;
  if (!data) return;

  const gsc = data.gsc || {};
  const ga4 = data.ga4 || {};
  const gscTotals = gsc.totals || {};
  const ga4Totals = ga4.totals || {};

  siteMode.textContent =
    data.sourceMode === "live" ? "Live" : data.sourceMode === "mixed" ? "Live + Demo" : "Demo mode";
  const dash = t("common.dash");
  gscRange.textContent = `${gsc.siteUrl || dash} · ${gsc.range?.startDate || dash} ~ ${gsc.range?.endDate || dash}`;
  ga4Range.textContent = `${ga4.propertyId ? t("ga4.property", { id: ga4.propertyId }) : dash} · ${ga4.range?.startDate || dash} ~ ${ga4.range?.endDate || dash}`;

  const delta = gsc.delta;
  gscSummary.innerHTML = [
    [t("gsc.clicks"), compactNum(gscTotals.clicks)],
    [t("gsc.impressions"), compactNum(gscTotals.impressions)],
    [t("gsc.ctr"), percent(gscTotals.ctr)],
    [t("gsc.position"), Number(gscTotals.position || 0).toFixed(1)],
    [t("gsc.queryCount"), compactNum(gscTotals.queryCount || (gsc.queries || []).length)],
    [
      t("gsc.delta"),
      delta
        ? t("gsc.deltaValue", {
            v: `${delta.clicks >= 0 ? "+" : ""}${(delta.clicks * 100).toFixed(1)}`,
            n: delta.halfDays
          })
        : t("gsc.deltaNa")
    ]
  ]
    .map(([label, value]) => `<div class="summary-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  ga4Summary.innerHTML = [
    [t("ga4.users"), compactNum(ga4Totals.activeUsers)],
    [t("ga4.sessions"), compactNum(ga4Totals.sessions)],
    [t("ga4.views"), compactNum(ga4Totals.screenPageViews)],
    [t("ga4.engagement"), percent(ga4Totals.engagementRate)],
    [t("ga4.duration"), t("ga4.durationValue", { n: Math.round(ga4Totals.averageSessionDuration || 0) })],
    [t("ga4.conversions"), `${compactNum(ga4Totals.conversions)} / ${percent(data.summary?.cvr)}`]
  ]
    .map(([label, value]) => `<div class="summary-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  gscQueries.innerHTML = renderBars(
    (gsc.queries || []).slice(0, 8).map(item => ({
      label: item.query,
      value: t("gsc.queryValue", {
        i: compactNum(item.impressions),
        c: compactNum(item.clicks),
        ctr: percent(item.ctr)
      }),
      ratio: item.impressions,
      badge: t("gsc.rank", { p: Number(item.position || 0).toFixed(1) })
    }))
  );

  const totalSessions = (ga4.channels || []).reduce((sum, item) => sum + (item.sessions || 0), 0) || 1;
  ga4Channels.innerHTML = renderBars(
    (ga4.channels || []).slice(0, 6).map(item => ({
      label: item.sessionDefaultChannelGroup,
      value: t("ga4.channelValue", { s: compactNum(item.sessions), e: percent(item.engagementRate) }),
      ratio: (item.sessions || 0) / totalSessions,
      badge: `${((item.sessions || 0) / totalSessions * 100).toFixed(1)}%`
    }))
  );

  gscOpportunities.innerHTML = renderBars(
    (gsc.opportunities || []).slice(0, 8).map(item => ({
      label: item.query,
      value: item.reasons.join(ATR_LANG === "zh" ? "；" : "; "),
      ratio: item.impressions,
      badge: `CTR ${percent(item.ctr)}`
    })),
    t("site.opportunitiesEmpty")
  );

  ga4Pages.innerHTML = renderBars(
    (ga4.pages || []).slice(0, 8).map(item => ({
      label: item.pagePath,
      value: t("ga4.pageValue", { v: compactNum(item.screenPageViews), u: compactNum(item.activeUsers) }),
      ratio: item.screenPageViews,
      badge: t("ga4.engage", { e: percent(item.engagementRate) }),
      weak: Number(item.engagementRate || 0) < 0.4
    }))
  );

  const insights = data.insights || [];
  const warnings = [...(data.warnings || []), ...(gsc.warnings || []).map(m => ({ source: "gsc", message: m })), ...(ga4.warnings || []).map(m => ({ source: "ga4", message: m }))];

  siteInsights.innerHTML =
    insights
      .map(
        insight => `
        <article class="insight-card ${escapeHtml(insight.priority.toLowerCase())}">
          <div class="insight-head">
            <span class="priority-pill">${escapeHtml(insight.priority)}</span>
            <strong>${escapeHtml(insight.title)}</strong>
          </div>
          <p class="insight-evidence">${escapeHtml(t("site.evidence", { text: insight.evidence }))}</p>
          <p class="insight-action">${escapeHtml(t("site.action", { text: insight.action }))}</p>
          ${
            insight.items && insight.items.length
              ? `<div class="chip-list">${insight.items
                  .slice(0, 5)
                  .map(item => `<span class="chip">${escapeHtml(item.label)} · ${escapeHtml(item.value)}</span>`)
                  .join("")}</div>`
              : ""
          }
        </article>`
      )
      .join("") +
    (warnings.length
      ? `<div class="site-warnings">${warnings
          .map(item => `<p><strong>${escapeHtml(item.source)}：</strong>${escapeHtml(item.message)}</p>`)
          .join("")}</div>`
      : "");

  if (!insights.length) {
    siteInsights.innerHTML = `<div class="empty-state">${escapeHtml(t("site.insightsEmpty"))}</div>`;
  }

  const demo = data.sourceMode !== "live";
  siteNote.textContent = demo
    ? t("site.demoNote")
    : t("site.liveNote", { q: gscQueries_count(gsc), c: (ga4.channels || []).length });
}

function gscQueries_count(gsc) {
  return (gsc.queries || []).length;
}

function renderBars(items, emptyText) {
  const empty = emptyText || t("common.empty");
  if (!items.length) return `<div class="empty-state">${escapeHtml(empty)}</div>`;
  const max = Math.max(...items.map(item => Number(item.ratio || 0)), 0) || 1;
  return items
    .map(
      item => `
        <article class="site-item ${item.weak ? "weak" : ""}">
          <div class="item-top">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="score">${escapeHtml(item.badge || "")}</span>
          </div>
          <div class="bar"><span style="width: ${Math.min(100, (Number(item.ratio || 0) / max) * 100).toFixed(1)}%"></span></div>
          <p class="item-copy">${escapeHtml(item.value)}</p>
        </article>`
    )
    .join("");
}

function compactNum(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(Math.round(number * 100) / 100);
}

function renderAds() {
  const ads = state.report?.ads || [];
  const sorted = [...ads].sort((a, b) => {
    const pa = PLATFORM_ORDER[a.platform] ?? 4;
    const pb = PLATFORM_ORDER[b.platform] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.heat ?? 0) - (a.heat ?? 0);
  });
  const filtered = state.filter === "all" ? sorted : sorted.filter(ad => ad.platform === state.filter);
  adsGrid.innerHTML = "";

  if (!filtered.length) {
    adsGrid.innerHTML = `<div class="empty-state">${escapeHtml(t("ad.empty"))}</div>`;
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
        creative.dataset.placeholder = ad.headline || t("ad.noImage");
      };
    } else {
      // 该广告没有图片素材，不再套用示例图，改用文字占位
      image.remove();
      creative.classList.add("no-image");
      creative.dataset.placeholder = ad.headline || t("ad.noImage");
    }
    node.querySelector(".platform-pill").textContent = ad.platform;
    node.querySelector(".advertiser").textContent = `${ad.advertiser} · ${ad.market} · ${ad.format}`;
    node.querySelector(".heat").textContent = `Heat ${ad.heat}`;
    node.querySelector("h3").textContent = ad.headline;
    node.querySelector("p").textContent = ad.body;
    node.querySelector(".source-link").href = ad.sourceUrl || "#";
    node.querySelector(".landing-link").href = ad.landingUrl || "#";

    // YouTube / TikTok 视频卡：追加「生成 Brief」动作
    if ((ad.platform === "youtube" || ad.platform === "tiktok") && ad.videoId) {
      const briefButton = document.createElement("button");
      briefButton.type = "button";
      briefButton.className = "source-link brief-button";
      briefButton.textContent = t("ad.brief");
      briefButton.addEventListener("click", () => runBrief(ad, briefButton));
      node.querySelector(".ad-actions").append(briefButton);
    }

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

// 视频情报一键生成投放 Brief（DeepSeek 生成，未配置 Key 时后端回退规则版模板）
async function runBrief(ad, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = t("ad.briefRunning");
  try {
    const response = await requestWithAuth(
      ad.platform === "tiktok" ? "/api/tiktok/brief" : "/api/youtube/brief",
      {
        method: "POST",
        body: JSON.stringify({
          videoId: ad.videoId,
          brand: state.report?.query?.brand || ""
        })
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "brief_failed");

    let output = button.closest(".ad-body").querySelector(".brief-output");
    if (!output) {
      output = document.createElement("pre");
      output.className = "brief-output";
      button.closest(".ad-body").append(output);
    }
    output.textContent = data.brief;
    button.textContent = data.engine === "deepseek" ? t("ad.briefAi") : t("ad.briefTemplate");
  } catch (error) {
    button.textContent = t("ad.briefFailed");
    setTimeout(() => { button.textContent = t("ad.brief"); }, 2500);
  } finally {
    button.disabled = false;
  }
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
          <a href="${source.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(
            source.platform === "gsc" || source.platform === "ga4" ? t("sources.openConsole") : t("sources.openTransparency")
          )}</a>
        </article>
      `
    )
    .join("");
}

function renderMissingConfig(source) {
  if (!source.missing || source.missing.length === 0) {
    return t("sources.ready", { key: source.directKey || source.envKey });
  }
  return t("sources.missing", { list: source.missing.join(ATR_LANG === "zh" ? " 或 " : " or ") });
}

function renderIteration() {
  const iteration = state.iteration;
  if (!iteration) return;

  document.querySelector("#metricBacklog").textContent = iteration.backlog.length;
  document.querySelector("#metricRules").textContent = t("metric.rules", { n: iteration.effectiveRequirements.requiredElements.length });

  renderRequirements(iteration.effectiveRequirements, iteration.inheritanceChain);
  renderSignals(iteration.signals);
  renderIterationSummary(iteration);
  renderBacklog(iteration.backlog);
}

function renderRequirements(requirements, chain) {
  const groups = [
    [t("iter.chain"), chain.map(item => `${item.label} ${t("iter.ruleCount", { n: item.rules })}`)],
    [t("iter.required"), requirements.requiredElements],
    [t("iter.banned"), requirements.bannedClaims],
    [t("iter.visual"), requirements.visualRules],
    [t("iter.offer"), requirements.offerRules]
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
    [t("sum.mode"), iteration.sourceMode === "imported" ? t("sum.modeImported") : t("sum.modeDemo")],
    [t("sum.rows"), summary.rows],
    [t("sum.spend"), money(summary.spend)],
    [t("sum.conversions"), summary.conversions],
    [t("sum.roas"), summary.roas],
    [t("sum.best"), summary.bestCreativeId],
    [t("sum.ctr"), percent(benchmarks.ctr)],
    [t("sum.cvr"), percent(benchmarks.cvr)],
    [t("sum.cpa"), money(benchmarks.cpa)]
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
              <span class="column-label">${escapeHtml(t("brief.actions"))}</span>
              <ul>${brief.actions.map(action => `<li>${escapeHtml(action)}</li>`).join("")}</ul>
            </div>
            <div>
              <span class="column-label">${escapeHtml(t("brief.checklist"))}</span>
              <ul>${brief.inheritedChecklist.slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </div>
          </div>
          <details>
            <summary>${escapeHtml(t("brief.prompt"))}</summary>
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
  const isZh = ATR_LANG === "zh";
  const bannedPattern = isZh ? /避免|禁用|不得|禁止|绝对/ : /avoid|banned|never|do not|don't|prohibit/i;
  const offerPattern = isZh ? /优惠|价格|落地页|权益|门槛/ : /offer|price|discount|landing page|benefit/i;
  const localPattern = isZh ? /本地|货币/ : /local|currency/i;
  const controlPattern = isZh ? /对照组/ : /control/i;

  const globalBannedRules = globalRules.filter(rule => bannedPattern.test(rule));
  const globalOfferRules = globalRules.filter(rule => offerPattern.test(rule));
  const globalRequiredRules = globalRules.filter(
    rule => !globalBannedRules.includes(rule) && !globalOfferRules.includes(rule)
  );

  return {
    global: {
      requiredElements: globalRequiredRules,
      bannedClaims: globalBannedRules,
      offerRules: globalOfferRules,
      objective: isZh ? "提升海外广告素材迭代效率" : "Improve overseas ad creative iteration efficiency"
    },
    market: {
      requiredElements: channelRules.filter(rule => localPattern.test(rule))
    },
    channel: {
      visualRules: channelRules.filter(rule => !localPattern.test(rule) && !controlPattern.test(rule))
    },
    campaign: {
      offerRules: channelRules.filter(rule => controlPattern.test(rule) || offerPattern.test(rule))
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
  runButton.querySelector("span:last-child").textContent = isLoading ? t("query.running") : t("query.run");
}

function setIterationLoading(isLoading) {
  iterationButton.disabled = isLoading;
  iterationButton.querySelector("span:last-child").textContent = isLoading ? t("iter.running") : t("iter.run");
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
