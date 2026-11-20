function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Generous headroom above the largest legitimate payload this app sends through readJsonBody
// (the Meta-from-Master carousel review, which can attach up to 6 rendered card images at
// roughly 3MB raw each -> ~24MB once base64-encoded), so real requests never trip this guard.
const MAX_JSON_BODY_BYTES = 30 * 1024 * 1024;

// The body is collected as bytes and decoded once at the end. Appending each chunk to a string decodes every
// chunk on its own, so a multi-byte character that straddles two chunks became two U+FFFD: on 2026-11-20 the
// ~1MB Klaviyo rollout of W47 reached Klaviyo's Romanian template with two replacement characters where
// "urgență" had its "ț".
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      if (typeof req.destroy === "function") req.destroy();
      reject(error);
    };

    const onData = (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_JSON_BODY_BYTES) {
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        fail(error);
        return;
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"));
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    };

    req.on("data", onData);
    req.on("end", onEnd);

    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

// The request body as bytes, for routes that receive a file rather than JSON. Refuses with 413 past maxBytes.
function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        settled = true;
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        if (typeof req.destroy === "function") req.destroy();
        reject(error);
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks)); } });
    req.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
  });
}

module.exports = {
  fetchWithTimeout,
  sendJson,
  readJsonBody,
  readRawBody,
  MAX_JSON_BODY_BYTES
};
