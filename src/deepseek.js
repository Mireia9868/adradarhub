// DeepSeek 文本生成封装：调用官方 Chat Completions 接口。
// 文档：https://api-docs.deepseek.com/
// 密钥通过环境变量 DEEPSEEK_API_KEY 注入，切勿硬编码进代码或提交到仓库。
// 仅用于非生图逻辑（总结、提示词、文案等）；图像生成仍由 Qwen 负责。

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

function sleep() {
  return Promise.resolve();
}

async function postJson(url, headers, body, timeoutMs = 30000) {
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

async function chatCompletion({
  system = "You are a helpful assistant.",
  prompt = "",
  model = DEFAULT_MODEL,
  temperature = 0.7,
  maxTokens = 1200,
  baseUrl
} = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const error = new Error("服务端未配置 DEEPSEEK_API_KEY，请在环境变量中设置文本生成密钥。");
    error.statusCode = 500;
    throw error;
  }
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    const error = new Error("缺少提示内容 (prompt)。");
    error.statusCode = 400;
    throw error;
  }

  const resolvedBase = (baseUrl || process.env.DEEPSEEK_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${resolvedBase}/chat/completions`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  const payload = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
    temperature,
    max_tokens: maxTokens,
    stream: false
  };

  const { res, data } = await postJson(url, headers, payload);
  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `DeepSeek 请求失败 (HTTP ${res.status})`;
    const error = new Error(message);
    error.statusCode = res.status;
    throw error;
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    const error = new Error("DeepSeek 未返回文本内容。");
    error.statusCode = 502;
    throw error;
  }
  return text;
}

module.exports = { chatCompletion, sleep };
