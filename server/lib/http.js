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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
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
      body += chunk;
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
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

module.exports = {
  fetchWithTimeout,
  sendJson,
  readJsonBody,
  MAX_JSON_BODY_BYTES
};
