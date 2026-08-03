const { fetchPlatformIntel, getConnectorStatus } = require("./connectors/transparency");

const DEFAULT_PLATFORMS = ["meta", "google", "bing"];

async function checkApiConnections(input = {}) {
  const website = normalizeWebsite(input.website || "garvee.com");
  const brand = deriveBrand(website.hostname);
  const markets = normalizeList(input.markets, ["US"]);
  const platforms = normalizeList(input.platforms, DEFAULT_PLATFORMS).filter(platform =>
    DEFAULT_PLATFORMS.includes(platform)
  );
  const sinceDays = Number(input.sinceDays || 30);

  const checks = await Promise.all(
    platforms.map(async platform => {
      const startedAt = Date.now();
      const status = getConnectorStatus(platform);

      try {
        const report = await fetchPlatformIntel(platform, {
          brand,
          website,
          markets,
          sinceDays
        });

        return {
          platform,
          ok: report.sourceMode === "live",
          sourceMode: report.sourceMode,
          configured: status.configured,
          mode: status.mode,
          ads: (report.ads || []).length,
          trends: (report.trends || []).length,
          competitors: (report.competitors || []).length,
          warnings: report.warnings || [],
          latencyMs: Date.now() - startedAt
        };
      } catch (error) {
        return {
          platform,
          ok: false,
          sourceMode: "error",
          configured: status.configured,
          mode: status.mode,
          ads: 0,
          trends: 0,
          competitors: 0,
          warnings: [error.message],
          latencyMs: Date.now() - startedAt
        };
      }
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    query: {
      domain: website.hostname,
      brand,
      markets,
      platforms,
      sinceDays
    },
    checks
  };
}

function normalizeWebsite(value) {
  const input = String(value || "").trim();
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProtocol);
  return url;
}

function deriveBrand(hostname) {
  return hostname
    .replace(/^www\./, "")
    .split(".")[0]
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeList(value, fallback) {
  if (typeof value === "string") {
    const items = value.split(",").map(item => item.trim()).filter(Boolean);
    return items.length ? items : fallback;
  }

  if (!Array.isArray(value)) return fallback;
  const items = value.map(item => String(item).trim()).filter(Boolean);
  return items.length ? items : fallback;
}

module.exports = {
  checkApiConnections
};
