const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = __dirname;
const port = 4173;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function buildQuery(searchParams) {
  const query = {};

  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      query[key] = Array.isArray(query[key])
        ? [...query[key], value]
        : [query[key], value];
      continue;
    }

    query[key] = value;
  }

  return query;
}

async function handleApiRequest(req, res, requestUrl) {
  const relativeApiPath = requestUrl.pathname.replace(/^\/+/, "");
  const directApiFilePath = `${relativeApiPath}.js`;
  let resolvedPath = path.normalize(path.join(root, directApiFilePath));
  let routeParams = {};

  if (
    !resolvedPath.startsWith(path.normalize(path.join(root, "api"))) ||
    path.extname(resolvedPath).toLowerCase() !== ".js"
  ) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    const dynamicSegments = relativeApiPath.split("/");
    if (dynamicSegments.length > 1) {
      const dynamicFilePath = path.normalize(path.join(root, ...dynamicSegments.slice(0, -1), "[action].js"));
      if (
        dynamicFilePath.startsWith(path.normalize(path.join(root, "api"))) &&
        path.extname(dynamicFilePath).toLowerCase() === ".js" &&
        fs.existsSync(dynamicFilePath)
      ) {
        resolvedPath = dynamicFilePath;
        routeParams = {
          action: dynamicSegments[dynamicSegments.length - 1]
        };
      } else {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
    } else {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
  }

  req.query = buildQuery(requestUrl.searchParams);
  req.params = routeParams;

  try {
    const handler = require(resolvedPath);

    if (typeof handler !== "function") {
      res.statusCode = 500;
      res.end("Invalid API handler");
      return;
    }

    await handler(req, res);

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error) {
    console.error(`API handler failed for ${requestUrl.pathname}:`, error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: error.message || "Internal server error." }));
    }
  }
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    handleApiRequest(req, res, requestUrl);
    return;
  }

  const rawPath = requestUrl.pathname;
  const relativePath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const resolvedPath = path.normalize(path.join(root, relativePath));

  if (!resolvedPath.startsWith(path.normalize(root))) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolvedPath, (error, file) => {
    if (error) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    res.setHeader("Content-Type", mime[extension] || "application/octet-stream");
    res.end(file);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local static server running at http://127.0.0.1:${port}/`);
});
