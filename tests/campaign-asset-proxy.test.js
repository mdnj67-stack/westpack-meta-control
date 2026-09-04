const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const apiSource = readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

const {
  fetchCampaignAssetSafely,
  proxyCampaignAsset,
  downloadCampaignAssetFile
} = require("../api/campaign/brain");

test("campaign image proxy streams large source images for the crop canvas", () => {
  const start = apiSource.indexOf("async function proxyCampaignAsset");
  const end = apiSource.indexOf("async function downloadCampaignAssetFile", start);
  const proxySource = apiSource.slice(start, end);

  assert.match(proxySource, /const maxStreamBytes = 20_000_000/);
  assert.match(proxySource, /for await \(const chunk of response\.body\)/);
  assert.match(proxySource, /res\.write\(Buffer\.from\(chunk\)\)/);
  assert.doesNotMatch(proxySource, /response\.arrayBuffer\(\)/);
});

test("neither proxyCampaignAsset nor downloadCampaignAssetFile hands fetch an unmediated redirect: follow", () => {
  assert.doesNotMatch(apiSource, /redirect:\s*"follow"/);
  assert.match(apiSource, /redirect:\s*"manual"/);
});

function fakeResponse({ status = 200, headers = {}, body = [], arrayBufferBytes = Buffer.alloc(0) } = {}) {
  const lowerHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    ok: status >= 200 && status < 300,
    url: "",
    headers: { get: (name) => lowerHeaders.get(String(name).toLowerCase()) ?? null },
    body,
    arrayBuffer: async () => {
      const view = arrayBufferBytes;
      return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
    }
  };
}

function withMockedFetch(handler, run) {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push(String(url));
    return handler(String(url), options, calls);
  };
  return run(calls).finally(() => {
    global.fetch = originalFetch;
  });
}

test("a redirect hop pointing at a private IP is rejected and never actually requested", () =>
  withMockedFetch(
    (url) => {
      if (url === "https://cdn.example.com/asset.jpg") {
        return fakeResponse({ status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } });
      }
      throw new Error(`disallowed host was requested: ${url}`);
    },
    async (calls) => {
      await assert.rejects(
        fetchCampaignAssetSafely("https://cdn.example.com/asset.jpg", { timeoutMs: 5000 }),
        /not allowed/i
      );
      assert.deepEqual(calls, ["https://cdn.example.com/asset.jpg"]);
    }
  ));

test("a redirect hop pointing at localhost is rejected and never actually requested", () =>
  withMockedFetch(
    (url) => {
      if (url === "https://cdn.example.com/asset.jpg") {
        return fakeResponse({ status: 302, headers: { location: "https://localhost:8080/admin" } });
      }
      throw new Error(`disallowed host was requested: ${url}`);
    },
    async (calls) => {
      await assert.rejects(
        fetchCampaignAssetSafely("https://cdn.example.com/asset.jpg", { timeoutMs: 5000 }),
        /not allowed/i
      );
      assert.deepEqual(calls, ["https://cdn.example.com/asset.jpg"]);
    }
  ));

test("a redirect hop pointing at a non-https target is rejected and never actually requested", () =>
  withMockedFetch(
    (url) => {
      if (url === "https://cdn.example.com/asset.jpg") {
        return fakeResponse({ status: 302, headers: { location: "http://10.0.0.5/internal" } });
      }
      throw new Error(`disallowed host was requested: ${url}`);
    },
    async (calls) => {
      await assert.rejects(
        fetchCampaignAssetSafely("https://cdn.example.com/asset.jpg", { timeoutMs: 5000 }),
        /HTTPS|not allowed/i
      );
      assert.deepEqual(calls, ["https://cdn.example.com/asset.jpg"]);
    }
  ));

test("proxyCampaignAsset rejects an SSRF redirect chain before streaming anything back", () =>
  withMockedFetch(
    (url) => {
      if (url === "https://cdn.example.com/asset.jpg") {
        return fakeResponse({ status: 302, headers: { location: "https://10.1.2.3/secret" } });
      }
      throw new Error(`disallowed host was requested: ${url}`);
    },
    async (calls) => {
      const res = { write: () => { throw new Error("must not stream a body"); }, setHeader: () => {}, end: () => {} };
      await assert.rejects(
        proxyCampaignAsset({ query: { url: "https://cdn.example.com/asset.jpg" } }, res),
        /not allowed/i
      );
      assert.deepEqual(calls, ["https://cdn.example.com/asset.jpg"]);
    }
  ));

test("a redirect loop that exceeds the hop limit throws instead of hanging", () =>
  withMockedFetch(
    (url) => {
      const n = Number(url.match(/hop(\d+)/)?.[1] || "0");
      return fakeResponse({ status: 302, headers: { location: `https://cdn.example.com/hop${n + 1}` } });
    },
    async (calls) => {
      await assert.rejects(
        fetchCampaignAssetSafely("https://cdn.example.com/hop0", { timeoutMs: 5000 }),
        /too many times/i
      );
      assert.ok(calls.length <= 7, `expected a bounded number of hops, saw ${calls.length}`);
    }
  ));

test("a legitimate single-hop redirect to another allowed public HTTPS host still resolves", () =>
  withMockedFetch(
    (url) => {
      if (url === "https://cdn.example.com/asset.jpg") {
        return fakeResponse({ status: 302, headers: { location: "https://images.allowed-cdn.com/final.jpg" } });
      }
      if (url === "https://images.allowed-cdn.com/final.jpg") {
        return fakeResponse({
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": "3" },
          body: [Buffer.from("abc")]
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
    async (calls) => {
      const { response, finalUrl } = await fetchCampaignAssetSafely("https://cdn.example.com/asset.jpg", { timeoutMs: 5000 });
      assert.equal(finalUrl, "https://images.allowed-cdn.com/final.jpg");
      assert.equal(response.status, 200);
      assert.deepEqual(calls, ["https://cdn.example.com/asset.jpg", "https://images.allowed-cdn.com/final.jpg"]);
    }
  ));

test("downloadCampaignAssetFile follows a legitimate redirect to an allowed host and returns the image bytes", () =>
  withMockedFetch(
    (url) => {
      if (url === "https://cdn.example.com/asset.jpg") {
        return fakeResponse({ status: 301, headers: { location: "https://images.allowed-cdn.com/final.jpg" } });
      }
      if (url === "https://images.allowed-cdn.com/final.jpg") {
        return fakeResponse({
          status: 200,
          headers: { "content-type": "image/png", "content-length": "5" },
          arrayBufferBytes: Buffer.from("hello")
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
    async (calls) => {
      const result = await downloadCampaignAssetFile("https://cdn.example.com/asset.jpg");
      assert.equal(result.contentType, "image/png");
      assert.equal(result.bytes.toString(), "hello");
      assert.deepEqual(calls, ["https://cdn.example.com/asset.jpg", "https://images.allowed-cdn.com/final.jpg"]);
    }
  ));
