const sourceUrls = {
  meta: "https://www.facebook.com/ads/library/",
  google: "https://adstransparency.google.com/",
  bing: "https://adlibrary.ads.microsoft.com/"
};

// 家居/电商类演示图（garvee、generic 档案沿用）
const homeImages = [
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80"
];

// 科技/设计类演示图（readdy 档案：建站、落地页、产品设计主题，已逐张人工核验内容）
const techImages = [
  "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=900&q=80"
];

const trendRecommendations = [
  "放到广告首屏标题，配合倒计时折扣。",
  "拆成独立搜索词组和 Shopping 标题词。",
  "用于 Meta 短视频前 3 秒字幕。",
  "加入落地页首屏信任模块。"
];

const competitorSignals = ["High promo velocity", "New video creatives", "Search conquesting", "Shopping feed expansion"];

// 品牌档案：让演示数据与默认站点对得上，避免出现类目/竞品和品牌完全不搭的情况。
const brandProfiles = {
  readdy: {
    images: techImages,
    categories: ["AI Website Builder", "Landing Page", "No-code", "Business Site"],
    competitors: [
      ["Wix", "wix.com"],
      ["Squarespace", "squarespace.com"],
      ["Framer", "framer.com"],
      ["Webflow", "webflow.com"],
      ["Durable", "durable.co"],
      ["10Web", "10web.io"]
    ],
    trends: [
      ["AI 一键生成官网", 97, "+38%", "Product demand"],
      ["No-code landing page", 92, "+31%", "Category"],
      ["Custom domain included", 88, "+26%", "Offer"],
      ["Mobile-first template", 84, "+21%", "Feature"],
      ["Publish in minutes", 79, "+16%", "Message"],
      ["Free plan to start", 74, "+12%", "Promo angle"],
      ["Portfolio site builder", 70, "+9%", "Category"],
      ["SEO-ready by default", 66, "+7%", "Feature"]
    ],
    adTemplates: [
      ["Build your site with AI", "Describe your business and get a ready-to-publish site in minutes — no code, no design skills.", "Start Free", "Video", 96],
      ["Your website, done today", "AI drafts layout, copy and images. You review, connect a domain and go live.", "Try It Free", "Image", 90],
      ["Launch a landing page in minutes", "Pick a template, let AI write the copy, then publish to a custom domain.", "Create Page", "Carousel", 86],
      ["Ship pages without engineering", "Marketing pages, product sites and portfolios ready without waiting on dev.", "See Plans", "Shopping", 82],
      ["Compare site builders", "See how AI-first publishing stacks up on speed, cost and design control.", "Compare", "Search", 79],
      ["Free plan, upgrade anytime", "Start on a free subdomain and move to a custom domain when you're ready.", "Get Started", "Responsive Search", 74]
    ]
  },
  garvee: {
    images: homeImages,
    categories: ["Outdoor Living", "Garage Storage", "Home Improvement", "Patio Furniture"],
    competitors: [
      ["Wayfair", "wayfair.com"],
      ["The Home Depot", "homedepot.com"],
      ["Costway", "costway.com"],
      ["Aosom", "aosom.com"],
      ["Overstock", "overstock.com"],
      ["Tractor Supply", "tractorsupply.com"]
    ],
    trends: [
      ["Labor Day early deal", 97, "+34%", "Promo angle"],
      ["Outdoor storage shed", 92, "+28%", "Product demand"],
      ["Fast shipping promise", 89, "+24%", "Message"],
      ["Buy now pay later", 84, "+18%", "Offer"],
      ["Weather resistant patio", 81, "+14%", "Feature"],
      ["Garage organization", 78, "+11%", "Category"],
      ["Price match language", 73, "+8%", "Trust"],
      ["Assembly included", 68, "+5%", "Objection handling"]
    ],
    adTemplates: [
      ["Summer Backyard Upgrade", "Transform your patio with durable outdoor essentials and limited-time savings.", "Shop Now", "Video", 96],
      ["Garage Space, Finally Sorted", "Heavy-duty racks and sheds built for tools, tires, and weekend projects.", "See Deals", "Image", 90],
      ["Weather-ready Furniture", "Patio sets made for rain, sun, and quick delivery across top US markets.", "Learn More", "Carousel", 86],
      ["Big-ticket Home Sale", "Save more when you bundle outdoor storage, seating, and garden upgrades.", "Get Offer", "Shopping", 82],
      ["Competitor Price Watch", "Compare value on best-selling home improvement products before checkout.", "Compare", "Search", 79],
      ["Free Shipping Threshold", "Popular outdoor picks ship fast with transparent delivery timelines.", "Shop Deals", "Responsive Search", 74]
    ]
  },
  generic: {
    images: homeImages,
    categories: ["Best Sellers", "Seasonal Sale", "Home Upgrade", "Bundle Offer"],
    competitors: [
      ["Wayfair", "wayfair.com"],
      ["The Home Depot", "homedepot.com"],
      ["Costway", "costway.com"],
      ["Aosom", "aosom.com"],
      ["Overstock", "overstock.com"],
      ["Tractor Supply", "tractorsupply.com"]
    ],
    trends: [
      ["Seasonal bundle offer", 94, "+30%", "Promo angle"],
      ["Fast shipping promise", 89, "+24%", "Message"],
      ["Limited-time discount", 85, "+19%", "Offer"],
      ["Best seller badge", 80, "+15%", "Trust"],
      ["Free returns", 75, "+11%", "Objection handling"],
      ["New arrivals", 71, "+9%", "Category"],
      ["Price match language", 68, "+7%", "Trust"],
      ["Bundle and save", 64, "+5%", "Offer"]
    ],
    adTemplates: [
      ["Season's Best Sellers", "Top-rated picks with limited-time savings across core categories.", "Shop Now", "Video", 96],
      ["Bundle and Save", "Save more when you build the complete set instead of buying pieces.", "See Deals", "Image", 90],
      ["New Arrivals Live", "Fresh inventory with fast delivery and transparent timelines.", "Learn More", "Carousel", 86],
      ["Limited-time Offer", "Discounts end soon — compare value before checkout.", "Get Offer", "Shopping", 82],
      ["Compare Before You Buy", "See how top sellers stack up on price, delivery and returns.", "Compare", "Search", 79],
      ["Free Shipping Threshold", "Popular picks ship fast once you cross the free-shipping minimum.", "Shop Deals", "Responsive Search", 74]
    ]
  }
};

function getBrandProfile(domainRoot) {
  if (domainRoot.includes("readdy")) return brandProfiles.readdy;
  if (domainRoot.includes("garvee")) return brandProfiles.garvee;
  return brandProfiles.generic;
}

function createDemoIntel({ brand, website, markets, platforms, sinceDays }) {
  const domainRoot = website.hostname.replace(/^www\./, "");
  const profile = getBrandProfile(domainRoot);
  const competitors = createCompetitors(profile);
  const trends = createTrends(profile, sinceDays);
  const ads = createAds({ brand, domainRoot, markets, platforms, competitors, trends, profile });

  return {
    competitors,
    trends,
    ads
  };
}

function createCompetitors(profile) {
  return profile.competitors.map(([name, domain], index) => ({
    name,
    domain,
    overlap: 94 - index * 7,
    category: profile.categories[index % profile.categories.length],
    signal: competitorSignals[index % competitorSignals.length],
    source: "Ad transparency center + SERP overlap model"
  }));
}

function createTrends(profile, sinceDays) {
  return profile.trends.map(([name, score, growth, type], index) => ({
    id: `trend-${index + 1}`,
    name,
    score,
    growth,
    type,
    category: profile.categories[index % profile.categories.length],
    window: `${sinceDays}d`,
    recommendation: trendRecommendations[index % trendRecommendations.length]
  }));
}

function createAds({ brand, domainRoot, markets, platforms, competitors, trends, profile }) {
  return profile.adTemplates.flatMap((template, index) => {
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
      imageUrl: profile.images[index % profile.images.length],
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
