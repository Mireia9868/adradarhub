/**
 * 静态内容页内容源（双语）。
 *
 * 这里只放"事实型"文案：产品实际做了什么、数据从哪来、有哪些限制。
 * 不写任何未经验证的市场数字、客户数量、效果提升百分比。
 *
 * 构建：node scripts/build-pages.js  ->  public/<slug>/index.html
 *                                     public/zh/<slug>/index.html
 *                                     public/sitemap.xml
 */

const SITE = "https://adradarhub.com";
// TODO(小都): 下面是占位联系邮箱，发出去前请确认真实可收信地址。
const CONTACT_EMAIL = "hello@adradarhub.com";
const UPDATED = "2026-10-28";

const pages = [
  /* ------------------------------------------------------------------ */
  {
    slug: "ad-library",
    title: {
      en: "How to check the ads your competitors are running (2026 guide)",
      zh: "怎么查竞品正在投的广告（2026 实操指南）"
    },
    description: {
      en: "A practical walkthrough of every free ad transparency library — Meta, Google, Microsoft, YouTube and TikTok — plus what each one can and cannot tell you.",
      zh: "逐个拆解免费的广告透明度库：Meta、Google、Microsoft、YouTube、TikTok，分别能看到什么、看不到什么，以及日常怎么用。"
    },
    h1: {
      en: "How to check the ads your competitors are running",
      zh: "怎么查竞品正在投的广告"
    },
    lead: {
      en: "Every major ad platform now publishes what advertisers are running. The data is free — the hard part is knowing which library answers which question, and where each one silently stops being useful.",
      zh: "主流广告平台现在都公开投放中的广告。数据本身免费，难的是知道哪个库能回答哪个问题，以及每个库在什么地方开始失效。"
    },
    eyebrow: { en: "Guide", zh: "指南" },
    toc: { en: "On this page", zh: "本页目录" },
    sections: [
      {
        id: "why",
        h2: { en: "Why ad transparency libraries exist", zh: "广告透明度库是怎么来的" },
        body: {
          en: `<p>Regulators pushed platforms to disclose political and, later, commercial advertising. The result is a set of public libraries you can query by advertiser name, keyword or region. For a marketer, this is the cheapest competitive research available: you see the actual creative, the landing page, and often how long an ad has been running.</p>
<p>Two caveats shape everything below. First, coverage is uneven — Meta is close to exhaustive, TikTok's public view is not. Second, these libraries are built for accountability, not for analysis: no performance data, no spend by default, limited history.</p>`,
          zh: `<p>监管推动平台披露广告主身份，最初针对政治广告，后来扩展到商业广告。结果是每个大平台都有一个可以按广告主、关键词或地区查询的公开库。对投放同学来说，这是成本最低的竞品研究方式：能看到真实素材、落地页，通常还能看到一条广告跑了多久。</p>
<p>有两个前提决定了下面所有内容。第一，覆盖度并不均匀——Meta 接近全量，TikTok 的公开视野远没有那么多。第二，这些库是为"问责"设计的，不是为"分析"设计的：没有效果数据，默认没有花费，历史深度也有限。</p>`
        }
      },
      {
        id: "meta",
        h2: { en: "Meta Ad Library", zh: "Meta 广告库" },
        body: {
          en: `<p>The most complete free source. Search by page name, browse by country, filter by ad category. For commercial ads you get the creative, the start date, the platforms it runs on, and the landing page. Political and issue ads additionally expose spend ranges and impressions.</p>
<p><strong>What it is good for:</strong> seeing how many creatives a competitor rotates, how often they refresh, and whether a winning angle has been running for months.</p>
<p><strong>Where it stops:</strong> no targeting, no spend for commercial ads, and search is by advertiser rather than by product or angle. Bulk analysis needs the Ad Library API, which requires an access token and identity verification — that is exactly the gate our Meta connector sits behind.</p>`,
          zh: `<p>免费来源里最完整的一个。可以按主页名称搜索、按国家浏览、按广告类别筛选。商业广告能看到素材、开始投放日期、投放版位和落地页；政治与议题广告额外公开花费区间和曝光量。</p>
<p><strong>适合看什么：</strong>竞品同时跑多少条素材、多久换一次、某个打法是不是已经跑了几个月。</p>
<p><strong>边界在哪：</strong>商业广告没有定向信息、没有花费；搜索是按广告主而不是按产品或卖点。要做批量分析得用 Ad Library API，需要 access token 和身份验证——我们的 Meta connector 就卡在这道门上。</p>`
        }
      },
      {
        id: "google",
        h2: { en: "Google Ads Transparency Center", zh: "Google 广告透明度中心" },
        body: {
          en: `<p>Search any verified advertiser and see the ads they have served across Search, Display, and YouTube. Google shows the creative, the format, the region, and the first and last date the ad was seen.</p>
<p><strong>What it is good for:</strong> capturing search ad copy and display creative in a specific market, and spotting which offers a competitor keeps re-running.</p>
<p><strong>Where it stops:</strong> Google exposes creative, not keywords. There is no public API for the transparency center in the way Meta has one, so any tool — including this one — needs to go through a connector or a licensed data provider, and result depth is bounded by what that path returns.</p>`,
          zh: `<p>搜索任意已验证广告主，能看到它在搜索、展示和 YouTube 上投放的广告。Google 会给出素材、格式、地区，以及首次和最后一次出现的日期。</p>
<p><strong>适合看什么：</strong>抓某个市场的搜索广告文案和展示素材，判断竞品在重复投哪些 offer。</p>
<p><strong>边界在哪：</strong>Google 公开的是创意，不是关键词。透明度中心没有 Meta 那种公开 API，所以任何工具（包括这个站）都要走 connector 或持牌数据源，能拿到多深取决于那条链路的返回。</p>`
        }
      },
      {
        id: "microsoft",
        h2: { en: "Microsoft Ad Library", zh: "Microsoft 广告库" },
        body: {
          en: `<p>Microsoft publishes a public Ad Library API covering ads served on the Microsoft Advertising network, which includes Bing search and syndicated placements. You query by advertiser, and results include the ad copy and the dates it was live.</p>
<p><strong>What it is good for:</strong> B2B and high-intent search markets, and for checking whether a competitor has expanded beyond Google.</p>
<p><strong>Where it stops:</strong> coverage is smaller than Google's and creative formats are mostly text. Access still requires an approved API key.</p>`,
          zh: `<p>Microsoft 提供公开的 Ad Library API，覆盖 Microsoft Advertising 网络上的广告，包括 Bing 搜索和联盟版位。按广告主查询，返回广告文案和投放日期。</p>
<p><strong>适合看什么：</strong>B2B 和高意图搜索市场，以及判断竞品是否已经走出 Google。</p>
<p><strong>边界在哪：</strong>覆盖小于 Google，素材以文字为主。调用依然需要申请通过的 API key。</p>`
        }
      },
      {
        id: "youtube-tiktok",
        h2: { en: "YouTube and TikTok", zh: "YouTube 与 TikTok" },
        body: {
          en: `<p><strong>YouTube:</strong> ad creative often also appears in the Google Ads Transparency Center, but to find the organic video a competitor is amplifying you need the YouTube Data API — search by channel or keyword, then read titles, descriptions, durations and view counts. It tells you what they are pushing, not what they are paying.</p>
<p><strong>TikTok:</strong> TikTok has no public ad library API equivalent to Meta's. Its Creative Center shows top ads and trend signals but is not a searchable archive per advertiser. Anything deeper requires a licensed third-party data provider, which is why this site's TikTok source is explicitly marked as third-party rather than official.</p>`,
          zh: `<p><strong>YouTube：</strong>广告素材通常也能在 Google 透明度中心看到，但要找到竞品正在放大的自然视频，需要用 YouTube Data API：按频道或关键词搜索，再读标题、描述、时长和播放量。它告诉你对方在推什么，不告诉你对方花了多少钱。</p>
<p><strong>TikTok：</strong>没有与 Meta 对等的公开广告库 API。Creative Center 会展示热门广告和趋势信号，但不是一个可按广告主检索的归档。要更深的数据只能接持牌第三方数据源——所以本站的 TikTok 数据源明确标注为第三方，而不是官方。</p>`
        }
      },
      {
        id: "workflow",
        h2: { en: "A repeatable weekly workflow", zh: "一套可复用的每周流程" },
        body: {
          en: `<ol>
<li><strong>Pick 3–5 competitors</strong>, not twenty. Include one direct rival, one adjacent category, and one player winning in a market you are entering.</li>
<li><strong>Scan weekly, same day.</strong> Ad libraries are snapshots; the signal is in the delta — new creatives, killed creatives, offers that keep running.</li>
<li><strong>Log start dates.</strong> An ad running 90+ days is either a winner or abandoned budget. Cross-check with the landing page before assuming it is a winner.</li>
<li><strong>Teardown the hook, not the whole ad.</strong> Record the first three seconds, the promise, the proof, and the CTA separately so the pattern is reusable.</li>
<li><strong>Turn it into a brief.</strong> A finding that stays in a spreadsheet changes nothing. Write the next creative as a concrete assignment with structure, claims allowed, and claims banned.</li>
</ol>
<p>This site exists to compress steps 2–5: one domain scan pulls the libraries in parallel, and the iteration module turns the result into a brief your creative team can shoot.</p>`,
          zh: `<ol>
<li><strong>选 3–5 个竞品</strong>，不要二十个。一个直接对手、一个相邻品类、一个在你正要进的市场里跑得不错的玩家。</li>
<li><strong>每周固定同一天扫一次。</strong>广告库是快照，信号在变化量里：新上的素材、被下掉的素材、一直没停的 offer。</li>
<li><strong>记录开始日期。</strong>跑了 90 天以上的广告，要么是赢家，要么是没人管的预算。先看落地页再判断。</li>
<li><strong>拆 hook，不要拆整条广告。</strong>前 3 秒、承诺、证明、CTA 分开记，模式才能复用。</li>
<li><strong>落成 brief。</strong>只留在表格里的发现不会改变任何事。把下一条素材写成明确任务：结构、可用卖点、禁用话术。</li>
</ol>
<p>这个站存在的意义就是把第 2–5 步压缩：一次域名扫描并行拉各库，迭代模块把结果变成素材团队能直接开拍的 brief。</p>`
        }
      }
    ],
    ctaHref: "/#ads",
    asideCta: {
      en: "Run a free scan on any domain — 10 pulls a day, no card.",
      zh: "免费扫任意域名，每天 10 次，不用绑卡。"
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "data-sources",
    title: {
      en: "Data sources, coverage and limits",
      zh: "数据源、覆盖范围与限制"
    },
    description: {
      en: "Exactly where each number on AdRadarHub comes from: which platform API, whether it is live or demo, how often it refreshes, and what it cannot see.",
      zh: "AdRadarHub 上每个数字的来源：调哪个平台接口、是实采还是演示、多久刷新、有哪些看不到的东西。"
    },
    h1: { en: "Data sources, coverage and limits", zh: "数据源、覆盖范围与限制" },
    lead: {
      en: "An ad intelligence tool is only as trustworthy as its provenance. This page lists every source we query, whether it is currently live, and where the data stops being authoritative.",
      zh: "广告情报工具的可信度等于它的数据出处。这一页列出我们调用的每个来源、当前是否实采、以及数据在什么地方不再权威。"
    },
    eyebrow: { en: "Transparency", zh: "透明度" },
    toc: { en: "On this page", zh: "本页目录" },
    sections: [
      {
        id: "coverage",
        h2: { en: "Coverage at a glance", zh: "覆盖总览" },
        body: {
          en: `<p>Status below reflects the production deployment and is refreshed whenever a connector changes. A <span class="badge badge-live">Live</span> badge means results come from the platform's own API or public endpoint. <span class="badge badge-demo">Demo</span> means the endpoint is not credentialed yet and the UI is showing sample data — clearly labelled in the interface so a demo result is never mistaken for a real one.</p>`,
          zh: `<p>下面的状态反映线上部署，connector 变更时会同步更新。<span class="badge badge-live">实采</span> 表示结果来自平台自己的 API 或公开接口。<span class="badge badge-demo">演示</span> 表示该接口尚未配好凭证，界面展示的是示例数据——界面上会明确标注，避免把演示结果当成真实结果。</p>`
        },
        table: {
          head: {
            en: ["Platform", "Source", "Access", "Status", "What it gives you"],
            zh: ["平台", "来源", "接入方式", "状态", "能拿到什么"]
          },
          rows: [
            {
              en: ["Meta", "Meta Ad Library API", "Official API token", { badge: "demo" }, "Creatives, start dates, placements, landing pages"],
              zh: ["Meta", "Meta Ad Library API", "官方 API token", { badge: "demo" }, "素材、开始日期、版位、落地页"]
            },
            {
              en: ["Google", "Ads Transparency Center", "External connector", { badge: "live" }, "Creative, format, region, first/last seen"],
              zh: ["Google", "广告透明度中心", "外部 connector", { badge: "live" }, "素材、格式、地区、首末次出现"]
            },
            {
              en: ["Bing", "Microsoft Ad Library API", "Official public API", { badge: "live" }, "Ad copy, advertiser, live dates"],
              zh: ["Bing", "Microsoft Ad Library API", "官方公开 API", { badge: "live" }, "广告文案、广告主、投放日期"]
            },
            {
              en: ["YouTube", "YouTube Data API v3", "Official API key", { badge: "live" }, "Video metadata, channel, views, duration"],
              zh: ["YouTube", "YouTube Data API v3", "官方 API key", { badge: "live" }, "视频元信息、频道、播放量、时长"]
            },
            {
              en: ["TikTok", "Third-party provider", "Licensed data provider", { badge: "live" }, "Video metadata and engagement signals"],
              zh: ["TikTok", "第三方数据服务", "持牌数据源", { badge: "live" }, "视频元信息与互动信号"]
            },
            {
              en: ["Search Console", "Google Search Console API", "Service account", { badge: "live" }, "Queries, impressions, clicks, positions"],
              zh: ["Search Console", "Google Search Console API", "服务账号", { badge: "live" }, "查询词、曝光、点击、排名"]
            },
            {
              en: ["Analytics", "GA4 Data API", "Service account", { badge: "live" }, "Channels, landing pages, conversions"],
              zh: ["Analytics", "GA4 Data API", "服务账号", { badge: "live" }, "渠道、落地页、转化"]
            }
          ]
        }
      },
      {
        id: "demo",
        h2: { en: "Why some sources are in demo mode", zh: "为什么有些源是演示模式" },
        body: {
          en: `<p>Two of the libraries we query are not open by default. Meta's Ad Library API requires a token tied to a verified identity, and Google's transparency data has no anonymous public endpoint. Until those credentials are issued and configured server-side, the site runs those connectors in demo mode and labels the output.</p>
<p>We would rather show a labelled demo than a quietly fabricated number. If a source you need is still in demo, the data-source panel inside the app tells you exactly which environment variable is missing.</p>`,
          zh: `<p>我们调用的库里有两个默认不开放。Meta 的 Ad Library API 需要绑定已验证身份的 token；Google 的透明度数据没有匿名的公开接口。在这些凭证下发并配置到服务端之前，站点会让对应 connector 跑在演示模式，并给输出打标。</p>
<p>我们宁愿显示一个标注清楚的演示，也不给一个悄悄编造的数字。如果你需要的源还在演示模式，应用内的数据源面板会准确告诉你缺哪个环境变量。</p>`
        }
      },
      {
        id: "limits",
        h2: { en: "What this data cannot tell you", zh: "这些数据告诉不了你什么" },
        body: {
          en: `<ul>
<li><strong>No spend figures</strong> for commercial ads. Political ads disclose ranges; commercial ones do not.</li>
<li><strong>No performance metrics.</strong> CTR, CVR, CPA and ROAS belong to the advertiser. Any tool claiming to show a competitor's ROAS is inferring, not measuring.</li>
<li><strong>No targeting details.</strong> You see the creative, not the audience, bid or budget.</li>
<li><strong>Snapshot history.</strong> Libraries show current state and dates, not a full day-by-day archive.</li>
<li><strong>Deduplication is heuristic.</strong> The same creative reused across campaigns can appear more than once.</li>
</ul>
<p>Our iteration module works around the last gap: you import your own campaign CSV, and the platform metrics come from your account rather than being guessed from a competitor's public footprint.</p>`,
          zh: `<ul>
<li><strong>没有花费数据</strong>（商业广告）。政治广告会公开区间，商业广告不会。</li>
<li><strong>没有效果指标。</strong>CTR、CVR、CPA、ROAS 属于广告主自己。任何声称能看到竞品 ROAS 的工具都是在推断，不是在测量。</li>
<li><strong>没有定向细节。</strong>你能看到素材，看不到受众、出价和预算。</li>
<li><strong>历史是快照。</strong>库展示的是当前状态和日期，不是逐日归档。</li>
<li><strong>去重是启发式的。</strong>同一条创意在不同 campaign 里复用，可能重复出现。</li>
</ul>
<p>迭代模块就是绕开最后一个缺口：你自己导入投放数据 CSV，效果指标来自你的账户，而不是从竞品的公开足迹里猜。</p>`
        }
      },
      {
        id: "refresh",
        h2: { en: "Freshness and quota", zh: "更新频率与额度" },
        body: {
          en: `<p>Scans are executed on demand — nothing is pre-crawled and cached, so a result reflects the moment you asked for it. Free accounts get ten pulls per day, resetting at midnight UTC+8. Each scan counts once regardless of how many platforms you select; image generation and text generation draw from the same daily pool.</p>
<p>Analytics pulls (Search Console / GA4) run against the service account you configure and are limited by Google's own API quotas, not by us.</p>`,
          zh: `<p>扫描是按需执行的，没有预抓取和缓存，所以结果反映的是你发起查询那一刻。免费账户每天 10 次，UTC+8 零点重置。一次扫描计一次，和你选了几个平台无关；生成图片和生成文案共用同一个每日额度。</p>
<p>站点数据分析（Search Console / GA4）跑在你配置的服务账号上，受 Google 自己的 API 配额限制，不受我们限制。</p>`
        }
      }
    ],
    ctaHref: "/#sources",
    asideCta: {
      en: "See the live status of every connector inside the app.",
      zh: "在应用内查看每个 connector 的实时状态。"
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "faq",
    title: { en: "Frequently asked questions", zh: "常见问题" },
    description: {
      en: "What AdRadarHub does, which platforms it covers, how the free quota works, and what it deliberately does not claim to do.",
      zh: "AdRadarHub 能做什么、覆盖哪些平台、免费额度怎么算，以及我们明确不承诺什么。"
    },
    h1: { en: "Frequently asked questions", zh: "常见问题" },
    lead: {
      en: "Short answers to the questions that come up before someone runs their first scan.",
      zh: "在第一次扫描之前，大家最常问的几个问题。"
    },
    eyebrow: { en: "FAQ", zh: "常见问题" },
    toc: { en: "On this page", zh: "本页目录" },
    faq: [
      {
        q: { en: "What exactly does AdRadarHub do?", zh: "AdRadarHub 具体做什么？" },
        a: {
          en: "You enter a domain and a market. It pulls what that advertiser and its closest competitors are running across ad transparency libraries, ranks the creatives by signal strength, and turns the result into a next-round creative brief.",
          zh: "输入一个域名和市场，它会从各广告透明度库拉取这个广告主和最接近的竞品正在投放的内容，按信号强度排序，再把结果整理成下一轮的素材 brief。"
        }
      },
      {
        q: { en: "Which platforms are covered?", zh: "覆盖哪些平台？" },
        a: {
          en: "Meta, Google, Bing, YouTube and TikTok for ad intelligence, plus Google Search Console and GA4 for your own site performance. Current live/demo status per platform is on the data sources page.",
          zh: "广告情报覆盖 Meta、Google、Bing、YouTube、TikTok；自有站点表现接入 Google Search Console 和 GA4。每个平台当前的实采/演示状态在数据源页面。"
        }
      },
      {
        q: { en: "Is the data real or sample data?", zh: "数据是真实的还是示例？" },
        a: {
          en: "Results are labelled. When a connector is credentialed you get live data from the platform; when it is not, the interface marks the output as demo. We never present generated numbers as measurements.",
          zh: "结果都带标注。connector 配好凭证时是平台实采数据；没配好时界面会标注为演示。我们不会把生成的数字当成实测结果展示。"
        }
      },
      {
        q: { en: "How does the free quota work?", zh: "免费额度怎么算？" },
        a: {
          en: "Ten pulls per day per account, resetting at midnight UTC+8. A scan costs one pull no matter how many platforms you select. Image and text generation share the same pool.",
          zh: "每个账号每天 10 次，UTC+8 零点重置。一次扫描算一次，与选择几个平台无关。生图和生文共用同一个额度池。"
        }
      },
      {
        q: { en: "Does it cost anything?", zh: "收费吗？" },
        a: {
          en: "It is free while in beta, including the daily quota. There is no card required and no paid tier announced yet.",
          zh: "测试期免费，包含每日额度。不需要绑卡，目前也没有公布付费档位。"
        }
      },
      {
        q: { en: "Can it see a competitor's spend or ROAS?", zh: "能看到竞品的花费或 ROAS 吗？" },
        a: {
          en: "No, and no tool can. Those numbers belong to the advertiser's account. What you get is creative, timing, placement and landing page — enough to reconstruct the strategy, not the P&L.",
          zh: "看不到，也没有工具能看到。这些数字在广告主自己的账户里。你拿到的是素材、时间、版位和落地页——足够还原策略，不足以还原损益。"
        }
      },
      {
        q: { en: "What is the creative iteration module for?", zh: "素材迭代模块是干嘛的？" },
        a: {
          en: "It merges client-level rules (brand, required elements, banned claims, market and platform constraints) with your own campaign CSV, then writes a brief that separates what to keep, what to change, and what to test next.",
          zh: "把客户层面的规则（品牌、必含元素、禁用话术、市场与平台约束）和你自己的投放数据 CSV 合并，然后写出明确的 brief：保留什么、改什么、下一轮测什么。"
        }
      },
      {
        q: { en: "Do I need an account?", zh: "需要注册吗？" },
        a: {
          en: "An account unlocks the daily quota and keeps your scan history. Signing up only needs an email and a password of at least eight characters.",
          zh: "注册后才有每日额度，也能保留扫描记录。注册只需要邮箱和至少 8 位密码。"
        }
      },
      {
        q: { en: "Where does my data go?", zh: "我的数据会被怎么处理？" },
        a: {
          en: "Account data is stored in Supabase Postgres. API keys for Google and the AI providers live server-side only and are never sent to the browser. Details are on the privacy page.",
          zh: "账号数据存在 Supabase Postgres。Google 和 AI 服务商的密钥只存在服务端，不会下发到浏览器。细节见隐私页。"
        }
      }
    ],
    sections: [],
    asideCta: {
      en: "Still unsure? Run one scan — it takes about a minute.",
      zh: "还不确定？跑一次扫描，大概一分钟。"
    }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "privacy",
    title: { en: "Privacy policy", zh: "隐私政策" },
    description: {
      en: "What AdRadarHub stores, what it sends to third parties, and how to delete your account data.",
      zh: "AdRadarHub 存了什么、会把什么发给第三方、怎么删除你的账号数据。"
    },
    h1: { en: "Privacy policy", zh: "隐私政策" },
    lead: {
      en: "A short, plain-language version of what happens to your data.",
      zh: "用大白话说清楚你的数据发生了什么。"
    },
    eyebrow: { en: "Legal", zh: "法律条款" },
    toc: { en: "On this page", zh: "本页目录" },
    sections: [
      {
        id: "collected",
        h2: { en: "What we collect", zh: "我们收集什么" },
        body: {
          en: `<ul>
<li><strong>Account data:</strong> email address and a password hash (scrypt). We never store the plaintext password.</li>
<li><strong>Usage data:</strong> how many pulls you have used in the current day, and the domains you scanned, so your history is available when you return.</li>
<li><strong>Optional analytics:</strong> if site analytics is enabled, aggregate page views collected through Google Analytics 4.</li>
</ul>
<p>We do not ask for a phone number, do not sell data, and do not run third-party ad retargeting on this site.</p>`,
          zh: `<ul>
<li><strong>账号数据：</strong>邮箱地址和密码哈希（scrypt）。我们不存明文密码。</li>
<li><strong>使用数据：</strong>当天已用次数，以及你扫描过的域名，用于回访时给你看历史。</li>
<li><strong>可选统计：</strong>如果开启站点统计，会通过 Google Analytics 4 收集聚合的页面浏览数据。</li>
</ul>
<p>我们不要求手机号，不卖数据，也不在本站跑第三方广告再营销。</p>`
        }
      },
      {
        id: "third-parties",
        h2: { en: "Third parties we call", zh: "我们调用的第三方" },
        body: {
          en: `<p>To produce a result, a scan may call the platform APIs listed on the <a href="/data-sources">data sources page</a>, plus an AI provider for text and image generation. Requests contain the domain, market and prompt you entered — they do not contain your email or password.</p>
<p>Credentials for those providers are held server-side as environment variables and are never exposed to the browser.</p>`,
          zh: `<p>为了产出结果，一次扫描可能调用<a href="/zh/data-sources">数据源页面</a>列出的平台接口，以及一家 AI 服务商做文本和图片生成。请求里只包含你输入的域名、市场和提示词——不含你的邮箱或密码。</p>
<p>这些服务商的凭证以环境变量形式只存在服务端，不会暴露给浏览器。</p>`
        }
      },
      {
        id: "retention",
        h2: { en: "Retention and deletion", zh: "保留与删除" },
        body: {
          en: `<p>Account and usage records are kept while your account exists. To delete your account and all associated records, email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> from the address you registered with; we will remove the data within 30 days.</p>`,
          zh: `<p>账号与使用记录在你账户存续期间保留。要删除账户及全部关联记录，请用注册邮箱发信到 <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>，我们会在 30 天内清除。</p>`
        }
      },
      {
        id: "cookies",
        h2: { en: "Cookies and local storage", zh: "Cookie 与本地存储" },
        body: {
          en: `<p>We use a session cookie to keep you logged in, and browser local storage for your language preference. Analytics, when enabled, sets its own cookies. There are no advertising cookies.</p>`,
          zh: `<p>我们用会话 cookie 维持登录状态，用浏览器本地存储记住语言偏好。启用统计时会写入统计服务自己的 cookie。没有广告 cookie。</p>`
        }
      },
      {
        id: "contact",
        h2: { en: "Contact", zh: "联系方式" },
        body: {
          en: `<p>Questions about this policy: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
          zh: `<p>关于本政策的问题：<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>。</p>`
        }
      }
    ],
    asideCta: { en: "Back to the tool", zh: "回到工具" }
  },

  /* ------------------------------------------------------------------ */
  {
    slug: "terms",
    title: { en: "Terms of use", zh: "使用条款" },
    description: {
      en: "The rules for using AdRadarHub: acceptable use, quota, third-party data, and liability.",
      zh: "使用 AdRadarHub 的规则：合理使用、额度、第三方数据与责任范围。"
    },
    h1: { en: "Terms of use", zh: "使用条款" },
    lead: {
      en: "By using AdRadarHub you agree to the terms below.",
      zh: "使用 AdRadarHub 即表示你同意以下条款。"
    },
    eyebrow: { en: "Legal", zh: "法律条款" },
    toc: { en: "On this page", zh: "本页目录" },
    sections: [
      {
        id: "service",
        h2: { en: "The service", zh: "服务内容" },
        body: {
          en: `<p>AdRadarHub aggregates publicly available advertising data and provides tooling to turn it into creative briefs. The service is provided free of charge during beta and may change, be limited, or be withdrawn at any time.</p>`,
          zh: `<p>AdRadarHub 聚合公开可得的广告数据，并提供把它整理成素材 brief 的工具。服务在测试期免费提供，可能随时变更、限流或停止。</p>`
        }
      },
      {
        id: "acceptable-use",
        h2: { en: "Acceptable use", zh: "合理使用" },
        body: {
          en: `<p>You agree not to: circumvent the daily quota or authentication; resell, scrape or bulk-export results for redistribution; use the service to harass advertisers or to build a competing dataset; or submit unlawful content as prompts.</p>
<p>Automated access to the site's API outside normal in-app usage is not permitted without written consent.</p>`,
          zh: `<p>你同意不：绕过每日额度或登录校验；转售、爬取或批量导出结果用于再分发；用本服务骚扰广告主，或用于构建竞品数据集；提交违法内容作为提示词。</p>
<p>未经书面同意，不允许在正常应用内使用之外对本站接口做自动化访问。</p>`
        }
      },
      {
        id: "data-disclaimer",
        h2: { en: "Third-party data and accuracy", zh: "第三方数据与准确性" },
        body: {
          en: `<p>Advertising data comes from third-party platforms and may be incomplete, delayed, or deduplicated by heuristic. Results are provided "as is", for research purposes. They are not a measurement of any advertiser's performance, and you should not treat them as such.</p>
<p>AI-generated copy and images are drafts. You are responsible for reviewing any generated asset for accuracy, rights, and compliance with the advertising policies of the platform you publish on.</p>`,
          zh: `<p>广告数据来自第三方平台，可能不完整、有延迟，或由启发式规则去重。结果按"现状"提供，仅用于研究。它不构成对任何广告主表现的测量，请不要当作测量结论使用。</p>
<p>AI 生成的文案和图片是草稿。你需要自行审核任何生成素材的准确性、权利归属，以及是否符合你投放平台的广告政策。</p>`
        }
      },
      {
        id: "liability",
        h2: { en: "Limitation of liability", zh: "责任限制" },
        body: {
          en: `<p>The service is provided without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect or consequential losses, including lost profit or lost ad spend, arising from use of the service.</p>`,
          zh: `<p>本服务不提供任何形式的担保。在法律允许的最大范围内，我们不对因使用本服务产生的间接或后果性损失负责，包括利润损失或广告花费损失。</p>`
        }
      },
      {
        id: "changes",
        h2: { en: "Changes and contact", zh: "变更与联系" },
        body: {
          en: `<p>We may update these terms; the date at the top of the page reflects the current version. Questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`,
          zh: `<p>我们可能更新这些条款，页面顶部的日期对应当前版本。问题咨询：<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>。</p>`
        }
      }
    ],
    asideCta: { en: "Back to the tool", zh: "回到工具" }
  }
];

const nav = [
  { href: "/ad-library/", hrefZh: "/zh/ad-library/", label: { en: "Ad library guide", zh: "广告库指南" }, match: "ad-library" },
  { href: "/data-sources/", hrefZh: "/zh/data-sources/", label: { en: "Data sources", zh: "数据源" }, match: "data-sources" },
  { href: "/faq/", hrefZh: "/zh/faq/", label: { en: "FAQ", zh: "常见问题" }, match: "faq" }
];

const footerLinks = [
  { href: "/ad-library/", hrefZh: "/zh/ad-library/", label: { en: "Ad library guide", zh: "广告库指南" } },
  { href: "/data-sources/", hrefZh: "/zh/data-sources/", label: { en: "Data sources", zh: "数据源" } },
  { href: "/faq/", hrefZh: "/zh/faq/", label: { en: "FAQ", zh: "常见问题" } },
  { href: "/privacy/", hrefZh: "/zh/privacy/", label: { en: "Privacy", zh: "隐私政策" } },
  { href: "/terms/", hrefZh: "/zh/terms/", label: { en: "Terms", zh: "使用条款" } }
];

module.exports = { pages, nav, footerLinks, SITE, UPDATED, CONTACT_EMAIL };
