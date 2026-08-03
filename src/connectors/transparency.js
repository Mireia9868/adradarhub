const { execFile } = require("node:child_process");

const CONNECTORS = {
  meta: {
    label: "Meta Ad Library",
    envKey: "META_TRANSPARENCY_ENDPOINT",
    directKey: "META_ACCESS_TOKEN",
    sourceUrl: "https://www.facebook.com/ads/library/",
    access: "official-api-token"
  },
  google: {
    label: "Google Ads Transparency Center",
    envKey: "GOOGLE_TRANSPARENCY_ENDPOINT",
    sourceUrl: "https://adstransparency.google.com/",
    access: "external-connector-required"
  },
  bing: {
    label: "Microsoft Advertising Transparency Center",
    envKey: "BING_TRANSPARENCY_ENDPOINT",
    directKey: "BING_AD_LIBRARY_DIRECT",
    sourceUrl: "https://adlibrary.ads.microsoft.com/",
    access: "official-public-api"
  }
};

async function fetchPlatformIntel(platform, query) {
  const connector = CONNECTORS[platform];
  if (!connector) {
    throw new Error(`unsupported_platform:${platform}`);
  }

  if (platform === "meta" && process.env.META_ACCESS_TOKEN) {
    return fetchMetaAdsLibrary(query);
  }

  if (platform === "bing" && process.env.BING_AD_LIBRARY_DIRECT !== "false") {
    return fetchMicrosoftAdLibrary(query);
  }

  const endpoint = process.env[connector.envKey];
  if (!endpoint) {
    return {
      platform,
      sourceMode: "demo",
      warnings: [`${connector.label} connector is not configured`],
      ads: [],
      trends: [],
      competitors: []
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000)),
    headers: {
      "content-type": "application/json",
      authorization: process.env.TRANSPARENCY_CONNECTOR_TOKEN
        ? `Bearer ${process.env.TRANSPARENCY_CONNECTOR_TOKEN}`
        : ""
    },
    body: JSON.stringify({
      platform,
      brand: query.brand,
      domain: query.website.hostname,
      markets: query.markets,
      sinceDays: query.sinceDays,
      sourceUrl: connector.sourceUrl
    })
  });

  if (!response.ok) {
    throw new Error(`${platform}_connector_failed:${response.status}`);
  }

  const payload = await response.json();
  return {
    platform,
    sourceMode: "live",
    warnings: payload.warnings || [],
    ads: normalizeAds(platform, payload.ads || []),
    trends: payload.trends || [],
    competitors: payload.competitors || []
  };
}

function getConnectorStatus(platform) {
  const connector = CONNECTORS[platform];
  const directConfigured =
    platform === "bing"
      ? process.env.BING_AD_LIBRARY_DIRECT !== "false"
      : Boolean(connector.directKey && process.env[connector.directKey]);
  const proxyConfigured = Boolean(process.env[connector.envKey]);
  const configured = Boolean(proxyConfigured || directConfigured);
  const mode =
    platform === "google" && !process.env[connector.envKey]
      ? "connector-required"
      : configured
        ? "live-ready"
        : "demo";
  const route = directConfigured ? "direct" : proxyConfigured ? "proxy" : "demo";

  return {
    platform,
    label: connector.label,
    configured,
    mode,
    route,
    access: connector.access,
    envKey: connector.envKey,
    directKey: connector.directKey || null,
    missing: getMissingConfig(platform, connector, { directConfigured, proxyConfigured }),
    sourceUrl: connector.sourceUrl
  };
}

function getMissingConfig(platform, connector, state) {
  if (platform === "bing" && state.directConfigured) return [];
  if (state.proxyConfigured) return [];
  if (platform === "meta") return [connector.directKey, connector.envKey];
  if (platform === "google") return [connector.envKey];
  return [connector.envKey];
}

function normalizeAds(platform, ads) {
  return ads.map((ad, index) => ({
    id: ad.id || `${platform}-live-${index + 1}`,
    platform,
    advertiser: ad.advertiser || ad.pageName || "Unknown advertiser",
    headline: ad.headline || ad.title || "Untitled ad",
    body: ad.body || ad.text || "",
    cta: ad.cta || "Learn More",
    format: ad.format || "Unknown",
    market: ad.market || "US",
    firstSeen: ad.firstSeen || ad.startDate || null,
    heat: Number(ad.heat || ad.score || 60),
    spendSignal: ad.spendSignal || "Unknown",
    landingUrl: ad.landingUrl || ad.url || "",
    sourceUrl: ad.sourceUrl || "",
    imageUrl: ad.imageUrl || "",
    tags: Array.isArray(ad.tags) ? ad.tags : []
  }));
}

async function fetchMetaAdsLibrary(query) {
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const url = new URL(`https://graph.facebook.com/${version}/ads_archive`);
  url.searchParams.set("access_token", process.env.META_ACCESS_TOKEN);
  url.searchParams.set("search_terms", query.brand || query.website.hostname);
  url.searchParams.set("search_type", process.env.META_SEARCH_TYPE || "KEYWORD_UNORDERED");
  url.searchParams.set("ad_type", process.env.META_AD_TYPE || "ALL");
  url.searchParams.set("ad_active_status", process.env.META_AD_ACTIVE_STATUS || "ALL");
  url.searchParams.set("ad_reached_countries", JSON.stringify(query.markets || ["US"]));
  url.searchParams.set("ad_delivery_date_min", dateDaysAgo(query.sinceDays));
  url.searchParams.set("limit", process.env.META_AD_LIBRARY_LIMIT || "30");
  url.searchParams.set(
    "fields",
    [
      "id",
      "page_id",
      "page_name",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "ad_snapshot_url",
      "publisher_platforms"
    ].join(",")
  );

  const payload = await fetchJson(url);
  return {
    platform: "meta",
    sourceMode: "live",
    warnings: payload.paging?.next ? [] : ["Meta returned one page of results; raise META_AD_LIBRARY_LIMIT for more rows."],
    ads: (payload.data || []).map((ad, index) => normalizeMetaAd(ad, query, index)),
    trends: [],
    competitors: []
  };
}

async function fetchMicrosoftAdLibrary(query) {
  const url = new URL(process.env.BING_AD_LIBRARY_BASE_URL || "https://adlibrary.api.bingads.microsoft.com/api/v1/Ads");
  url.searchParams.set("top", process.env.BING_AD_LIBRARY_LIMIT || "30");
  url.searchParams.set("skip", "0");
  url.searchParams.set("searchText", query.brand || query.website.hostname);
  url.searchParams.set("startDate", dateDaysAgo(query.sinceDays));
  url.searchParams.set("endDate", dateToday());

  if (process.env.BING_AD_LIBRARY_COUNTRY_CODES) {
    url.searchParams.set("countryCodes", process.env.BING_AD_LIBRARY_COUNTRY_CODES);
  }

  const payload = await fetchJson(url);
  const rows = Array.isArray(payload) ? payload : payload.value || payload.ads || payload.data || [];

  return {
    platform: "bing",
    sourceMode: "live",
    warnings: rows.length ? [] : ["Microsoft Ad Library returned no rows for this query or market."],
    ads: rows.map((ad, index) => normalizeMicrosoftAd(ad, query, index)),
    trends: [],
    competitors: []
  };
}

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000))
    });
  } catch (error) {
    if (process.env.CONNECTOR_CURL_FALLBACK === "false" || options?.method) {
      throw error;
    }
    return fetchJsonWithCurl(url);
  }

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`connector_returned_non_json:${response.status}`);
  }

  if (!response.ok) {
    const message = payload.error?.message || payload.title || payload.message || response.statusText;
    throw new Error(`connector_failed:${response.status}:${message}`);
  }

  return payload;
}

function fetchJsonWithCurl(url) {
  return new Promise((resolve, reject) => {
    const timeoutSeconds = Math.ceil(Number(process.env.CONNECTOR_TIMEOUT_MS || 15000) / 1000);
    execFile(
      "curl",
      ["-L", "--silent", "--show-error", "--max-time", String(timeoutSeconds), String(url)],
      { maxBuffer: 2_000_000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`curl_connector_failed:${stderr || error.message}`));
          return;
        }

        try {
          resolve(stdout ? JSON.parse(stdout) : {});
        } catch {
          reject(new Error("curl_connector_returned_non_json"));
        }
      }
    );
  });
}

function normalizeMetaAd(ad, query, index) {
  const title = firstText(ad.ad_creative_link_titles) || `${ad.page_name || query.brand} ad`;
  const body = firstText(ad.ad_creative_bodies) || firstText(ad.ad_creative_link_descriptions);
  const caption = firstText(ad.ad_creative_link_captions);
  const firstSeen = ad.ad_delivery_start_time || null;

  return {
    id: ad.id || `meta-live-${index + 1}`,
    platform: "meta",
    advertiser: ad.page_name || query.brand,
    headline: title,
    body: body || caption || "Meta Ad Library creative text is available from the source snapshot.",
    cta: "View Snapshot",
    format: (ad.publisher_platforms || ["Meta"]).join(" / "),
    market: (query.markets || ["US"])[0],
    firstSeen,
    heat: estimateHeat(firstSeen, index),
    spendSignal: ad.ad_delivery_stop_time ? "Ended" : "Active or recently active",
    landingUrl: caption && caption.startsWith("http") ? caption : `https://${query.website.hostname}/`,
    sourceUrl: ad.ad_snapshot_url || CONNECTORS.meta.sourceUrl,
    imageUrl: "",
    tags: ["Meta Ad Library", query.brand]
  };
}

function normalizeMicrosoftAd(ad, query, index) {
  const advertiser = ad.AdvertiserName || ad.advertiserName || ad.advertiser || query.brand;
  const title =
    ad.Title ||
    ad.title ||
    ad.Headline ||
    ad.headline ||
    ad.AdText ||
    `${advertiser} Microsoft ad`;
  const body =
    ad.Description ||
    ad.description ||
    ad.Body ||
    ad.body ||
    ad.AdText ||
    "Microsoft Ad Library result is available from the source record.";
  const firstSeen = ad.FirstShownDate || ad.firstShownDate || ad.StartDate || ad.startDate || null;
  const landingUrl = ad.DestinationUrl || ad.destinationUrl || ad.FinalUrl || ad.finalUrl || `https://${query.website.hostname}/`;

  return {
    id: String(ad.Id || ad.id || ad.AdId || `bing-live-${index + 1}`),
    platform: "bing",
    advertiser,
    headline: title,
    body,
    cta: "Open Result",
    format: ad.MediaType || ad.mediaType || ad.Format || "Microsoft Ad",
    market: ad.CountryName || ad.countryName || (query.markets || ["US"])[0],
    firstSeen,
    heat: estimateHeat(firstSeen, index),
    spendSignal: ad.Status || ad.status || "Observed",
    landingUrl,
    sourceUrl: ad.AdUrl || ad.adUrl || CONNECTORS.bing.sourceUrl,
    imageUrl: extractMicrosoftImage(ad),
    tags: ["Microsoft Ad Library", query.brand]
  };
}

function extractMicrosoftImage(ad) {
  const direct = ad.ImageUrl || ad.imageUrl || ad.ThumbnailUrl || ad.thumbnailUrl;
  if (direct) return direct;

  const assetJson = ad.AssetJson || ad.assetJson;
  if (!assetJson) return "";

  try {
    const parsed = typeof assetJson === "string" ? JSON.parse(assetJson) : assetJson;
    const assets = Array.isArray(parsed) ? parsed : Object.values(parsed).flat();
    const image = assets.find(asset => typeof asset?.url === "string" || typeof asset?.Url === "string");
    return image?.url || image?.Url || "";
  } catch {
    return "";
  }
}

function firstText(value) {
  if (Array.isArray(value)) return value.find(Boolean) || "";
  return value || "";
}

function estimateHeat(firstSeen, index) {
  if (!firstSeen) return Math.max(60, 88 - index * 3);
  const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(firstSeen)) / 86_400_000));
  return Math.max(55, Math.min(96, 96 - ageDays - index));
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 30));
  return date.toISOString().slice(0, 10);
}

function dateToday() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  fetchPlatformIntel,
  getConnectorStatus
};
