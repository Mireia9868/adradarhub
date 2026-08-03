const sourceUrls = {
  meta: "https://www.facebook.com/ads/library/",
  google: "https://adstransparency.google.com/",
  bing: "https://adlibrary.ads.microsoft.com/"
};

const imageUrls = [
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80"
];

function createDemoIntel({ brand, website, markets, platforms, sinceDays }) {
  const domainRoot = website.hostname.replace(/^www\./, "");
  const categories = inferCategories(domainRoot);
  const competitors = createCompetitors(categories);
  const trends = createTrends(categories, sinceDays);
  const ads = createAds({ brand, domainRoot, markets, platforms, competitors, trends });

  return {
    competitors,
    trends,
    ads
  };
}

function inferCategories(domainRoot) {
  if (domainRoot.includes("garvee")) {
    return ["Outdoor Living", "Garage Storage", "Home Improvement", "Patio Furniture"];
  }
  return ["Best Sellers", "Seasonal Sale", "Home Upgrade", "Bundle Offer"];
}

function createCompetitors(categories) {
  const names = [
    ["Wayfair", "wayfair.com"],
    ["The Home Depot", "homedepot.com"],
    ["Costway", "costway.com"],
    ["Aosom", "aosom.com"],
    ["Overstock", "overstock.com"],
    ["Tractor Supply", "tractorsupply.com"]
  ];

  return names.map(([name, domain], index) => ({
    name,
    domain,
    overlap: 94 - index * 7,
    category: categories[index % categories.length],
    signal: ["High promo velocity", "New video creatives", "Search conquesting", "Shopping feed expansion"][index % 4],
    source: "Ad transparency center + SERP overlap model"
  }));
}

function createTrends(categories, sinceDays) {
  const trends = [
    ["Labor Day early deal", 97, "+34%", "Promo angle"],
    ["Outdoor storage shed", 92, "+28%", "Product demand"],
    ["Fast shipping promise", 89, "+24%", "Message"],
    ["Buy now pay later", 84, "+18%", "Offer"],
    ["Weather resistant patio", 81, "+14%", "Feature"],
    ["Garage organization", 78, "+11%", "Category"],
    ["Price match language", 73, "+8%", "Trust"],
    ["Assembly included", 68, "+5%", "Objection handling"]
  ];

  return trends.map(([name, score, growth, type], index) => ({
    id: `trend-${index + 1}`,
    name,
    score,
    growth,
    type,
    category: categories[index % categories.length],
    window: `${sinceDays}d`,
    recommendation: [
      "放到广告首屏标题，配合倒计时折扣。",
      "拆成独立搜索词组和 Shopping 标题词。",
      "用于 Meta 短视频前 3 秒字幕。",
      "加入落地页首屏信任模块。"
    ][index % 4]
  }));
}

function createAds({ brand, domainRoot, markets, platforms, competitors, trends }) {
  const templates = [
    ["Summer Backyard Upgrade", "Transform your patio with durable outdoor essentials and limited-time savings.", "Shop Now", "Video", 96],
    ["Garage Space, Finally Sorted", "Heavy-duty racks and sheds built for tools, tires, and weekend projects.", "See Deals", "Image", 90],
    ["Weather-ready Furniture", "Patio sets made for rain, sun, and quick delivery across top US markets.", "Learn More", "Carousel", 86],
    ["Big-ticket Home Sale", "Save more when you bundle outdoor storage, seating, and garden upgrades.", "Get Offer", "Shopping", 82],
    ["Competitor Price Watch", "Compare value on best-selling home improvement products before checkout.", "Compare", "Search", 79],
    ["Free Shipping Threshold", "Popular outdoor picks ship fast with transparent delivery timelines.", "Shop Deals", "Responsive Search", 74]
  ];

  return templates.flatMap((template, index) => {
    const [headline, body, cta, format, heat] = template;
    const platform = platforms[index % platforms.length];
    const advertiser = index < 2 ? brand : competitors[index % competitors.length].name;
    const domain = index < 2 ? domainRoot : competitors[index % competitors.length].domain;

    return {
      id: `${platform}-demo-${index + 1}`,
      platform,
      advertiser,
      headline,
      body,
      cta,
      format,
      market: markets[index % markets.length],
      firstSeen: daysAgo(3 + index * 4),
      heat,
      spendSignal: ["Scaling", "Testing", "Evergreen"][index % 3],
      landingUrl: `https://${domain}/`,
      sourceUrl: sourceUrls[platform],
      imageUrl: imageUrls[index % imageUrls.length],
      tags: [trends[index % trends.length].name, competitors[index % competitors.length].category]
    };
  });
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

module.exports = {
  createDemoIntel
};
