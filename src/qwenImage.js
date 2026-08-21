// Qwen (通义) 图像生成封装：提交异步任务并轮询结果。
// 文档：https://docs.qwencloud.com/api-reference/image-generation/qwen-text-to-image-async
// 密钥通过环境变量 QWEN_API_KEY 注入，切勿硬编码进代码或提交到仓库。

const DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/api/v1";
const DEFAULT_MODEL = "qwen-image-plus";
const SUPPORTED_SIZES = [
  "1664*928",
  "1472*1104",
  "1328*1328",
  "1104*1472",
  "928*1664"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function getJson(url, headers, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

async function generateImage({
  prompt,
  negativePrompt = "",
  size = "1664*928",
  model = DEFAULT_MODEL,
  pollTimeoutMs = 180000,
  pollIntervalMs = 4000
} = {}) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    const error = new Error("服务端未配置 QWEN_API_KEY，请在环境变量中设置图像生成密钥。");
    error.statusCode = 500;
    throw error;
  }
  if (!prompt || !prompt.trim()) {
    const error = new Error("缺少提示词 (prompt)。");
    error.statusCode = 400;
    throw error;
  }

  const baseUrl = (process.env.QWEN_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const finalSize = SUPPORTED_SIZES.includes(size) ? size : "1664*928";

  const submitUrl = `${baseUrl}/services/aigc/text2image/image-synthesis`;
  const submitHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-DashScope-Async": "enable"
  };
  const submitBody = {
    model,
    input: { prompt: prompt.trim(), negative_prompt: negativePrompt || "" },
    parameters: { size: finalSize, n: 1, prompt_extend: true, watermark: false }
  };

  const { res: submitRes, data: submitData } = await postJson(submitUrl, submitHeaders, submitBody);
  if (!submitRes.ok) {
    const message =
      submitData?.message ||
      submitData?.error?.message ||
      `提交失败 (HTTP ${submitRes.status})`;
    const error = new Error(message);
    error.statusCode = submitRes.status;
    throw error;
  }

  const taskId = submitData?.output?.task_id;
  if (!taskId) {
    const error = new Error("未返回任务 ID，无法轮询生成结果。");
    error.statusCode = 502;
    throw error;
  }

  const taskUrl = `${baseUrl}/tasks/${taskId}`;
  const deadline = Date.now() + pollTimeoutMs;
  let lastStatus = "PENDING";

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    const { data: task } = await getJson(taskUrl, { Authorization: `Bearer ${apiKey}` });
    lastStatus = task?.output?.task_status || lastStatus;

    if (lastStatus === "SUCCEEDED") {
      const results = task?.output?.results || [];
      const images = results.map(item => item.url).filter(Boolean);
      if (!images.length) {
        const error = new Error("生成成功但未返回图片地址。");
        error.statusCode = 502;
        throw error;
      }
      return images;
    }
    if (lastStatus === "FAILED") {
      const error = new Error(task?.output?.message || task?.message || "图像生成任务失败。");
      error.statusCode = 502;
      throw error;
    }
  }

  const error = new Error(`生成超时（${Math.round(pollTimeoutMs / 1000)}s 未结束，当前状态 ${lastStatus}）。`);
  error.statusCode = 504;
  throw error;
}

module.exports = { generateImage };
