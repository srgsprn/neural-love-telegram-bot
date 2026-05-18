const API_BASE = "https://api.neural.love/v1";
const DEFAULT_PROCESSING_MODEL = "default";

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

function errorMessage(data, res) {
  return (
    data?.detail ||
    data?.message ||
    data?.error ||
    data?.title ||
    data?.raw ||
    res.statusText ||
    String(res.status)
  );
}

function formatApiError(status, data, res) {
  const detail = errorMessage(data, res);
  if (status === 402) {
    return "Недостаточно кредитов на neural.love. Пополните баланс на сайте сервиса.";
  }
  if (status === 487) {
    return "Файл ещё проверяется на neural.love. Подождите минуту и отправьте фото снова.";
  }
  if (status === 439) {
    return "Слишком много заказов в обработке. Подождите и попробуйте снова.";
  }
  if (status === 401) {
    return "Ошибка авторизации API neural.love. Проверьте ключ на сервере.";
  }
  return detail;
}

/** API expects `model` inside some operation objects (not at parameters root). */
export function normalizeParameters(parameters) {
  const params = { ...parameters };

  if (params.quality_enhance && typeof params.quality_enhance === "object") {
    params.quality_enhance = {
      model: DEFAULT_PROCESSING_MODEL,
      ...params.quality_enhance,
    };
  }

  if (params.image_colorization !== undefined) {
    const base =
      typeof params.image_colorization === "object" && params.image_colorization
        ? params.image_colorization
        : {};
    params.image_colorization = {
      model: DEFAULT_PROCESSING_MODEL,
      hd_quality: false,
      ...base,
    };
  }

  return params;
}

async function readJson(res) {
  const body = await res.text();
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    data = { raw: body };
  }
  if (!res.ok) {
    throw new Error(
      `neural.love ${res.status}: ${formatApiError(res.status, data, res)}`
    );
  }
  return data;
}

function extensionFromMime(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] || "jpg";
}

export async function uploadImage(apiKey, buffer, mimeType) {
  const contentType = mimeType || "image/jpeg";
  const extension = extensionFromMime(contentType);

  const presign = await readJson(
    await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ extension, contentType }),
    })
  );

  const putRes = await fetch(presign.url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
  });
  if (!putRes.ok) {
    throw new Error(`Upload to storage failed: ${putRes.status}`);
  }

  return presign.s3Url;
}

export async function createImageOrder(apiKey, s3Url, parameters) {
  const normalized = normalizeParameters(parameters);
  const payload = JSON.stringify({
    files: [s3Url],
    parameters: normalized,
  });
  const headers = {
    ...authHeaders(apiKey),
    "Content-Type": "application/json",
  };
  // After S3 upload the file is scanned; API returns 487 until ready.
  const retryDelaysMs = [5000, 10000, 15000, 20000, 25000, 30000, 30000];

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelaysMs[attempt - 1]);
    }

    const res = await fetch(`${API_BASE}/images/process`, {
      method: "POST",
      headers,
      body: payload,
    });

    if (res.status === 487) {
      continue;
    }

    const data = await readJson(res);
    const orderId = data.orderId || data.id || data.order?.id;
    if (!orderId) {
      throw new Error("No orderId in neural.love response");
    }
    return orderId;
  }

  throw new Error(formatApiError(487, {}, { status: 487, statusText: "" }));
}

function pickResultUrls(order) {
  const urls = [];
  const files = order?.files || order?.result?.files || [];
  for (const file of files) {
    const url =
      file?.url ||
      file?.downloadUrl ||
      file?.resultUrl ||
      file?.outputUrl ||
      (typeof file === "string" ? file : null);
    if (url && /^https?:\/\//i.test(url)) urls.push(url);
  }
  if (order?.resultUrl && /^https?:\/\//i.test(order.resultUrl)) {
    urls.push(order.resultUrl);
  }
  return [...new Set(urls)];
}

export async function waitForOrder(apiKey, orderId, { onProgress } = {}) {
  const delays = [5000, 10000, 15000, 20000, 25000, 30000, 30000, 30000];
  let attempt = 0;

  for (const delay of delays) {
    await sleep(delay);
    attempt += 1;

    const order = await readJson(
      await fetch(`${API_BASE}/images/orders/${orderId}`, {
        headers: authHeaders(apiKey),
      })
    );

    const ready =
      order?.status?.isReady === true ||
      order?.isReady === true ||
      order?.status === "ready" ||
      order?.status === "completed";

    const failed =
      order?.status?.isFailed === true ||
      order?.status === "failed" ||
      order?.status === "error";

    if (onProgress) {
      await onProgress({ attempt, ready, failed, order });
    }

    if (failed) {
      const reason =
        order?.status?.message || order?.error || "обработка завершилась с ошибкой";
      throw new Error(reason);
    }

    const urls = pickResultUrls(order);
    if (ready && urls.length > 0) {
      return { order, urls };
    }
    if (ready && urls.length === 0) {
      throw new Error("Заказ готов, но ссылка на файл не найдена в ответе API");
    }
  }

  throw new Error("Таймаут ожидания результата (попробуйте ещё раз позже)");
}

export async function processImage(apiKey, buffer, mimeType, parameters) {
  const s3Url = await uploadImage(apiKey, buffer, mimeType);
  const orderId = await createImageOrder(apiKey, s3Url, parameters);
  const { urls } = await waitForOrder(apiKey, orderId);
  return { orderId, urls };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
