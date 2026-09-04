// 生图路由：优先走外部 IMAGE_GEN_ENDPOINT（Cloudflare Worker 等代理），
// 未配置时回退到内置 Qwen 实现。对外统一返回 { images: [url, ...] }，
// 前端（public/app.js）只消费 data.images，渲染逻辑无需改动。
//
// 设计要点：
// - IMAGE_GEN_ENDPOINT 指向的代理返回 { imageUrl: "data:..." }（内联 base64），
//   由本模块包成 images 数组，浏览器直接内联渲染，不跳站外、不暴露图源。
// - 代理密钥只存在 Worker 侧，站点后端只持有 endpoint 地址，密钥不落本仓库。

const { generateImage: generateViaQwen } = require("./qwenImage");

async function postJsonWithTimeout(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

async function generateViaEndpoint({
  endpoint,
  prompt,
  negativePrompt,
  size,
  steps,
  timeoutMs = 90000
}) {
  const { res, data } = await postJsonWithTimeout(
    endpoint,
    { "content-type": "application/json" },
    { prompt, negativePrompt: negativePrompt || "", size: size || "", steps: steps || 4 },
    timeoutMs
  );

  // 代理自身返回的结构化错误（如 { error, code }）
  if (!res.ok || data.error) {
    const message =
      data.error ||
      (data.errors && data.errors[0] && data.errors[0].message) ||
      `IMAGE_GEN_ENDPOINT 返回 HTTP ${res.status}`;
    const error = new Error(message);
    error.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
    error.code = data.code || "IMG_ENDPOINT_ERROR";
    throw error;
  }

  const rawUrl = data.imageUrl || (Array.isArray(data.images) && data.images[0]);
  if (!rawUrl) {
    const error = new Error("IMAGE_GEN_ENDPOINT 未返回 imageUrl");
    error.statusCode = 502;
    error.code = "IMG_ENDPOINT_EMPTY";
    throw error;
  }

  // 代理已返回内联 data URL；统一成数组，前端直接用 <img src> 渲染
  const images = Array.isArray(data.images) && data.images.length ? data.images : [rawUrl];
  return images;
}

async function generateImage(input = {}) {
  const endpoint = process.env.IMAGE_GEN_ENDPOINT;
  if (endpoint) {
    return generateViaEndpoint({
      endpoint,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      size: input.size,
      steps: input.steps
    });
  }
  // 兜底：内置 Qwen（需配置 QWEN_API_KEY）
  return generateViaQwen(input);
}

module.exports = { generateImage };
