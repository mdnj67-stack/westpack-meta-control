const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const apiSource = readFileSync(path.join(__dirname, "..", "api", "campaign", "brain.js"), "utf8");

// Every direct call to the OpenAI API from this handler must carry a bounded abort signal so a
// hung upstream request can't block the serverless invocation indefinitely. This mirrors the
// asset-download helpers in the same file (fetchCampaignAssetSafely, the Klaviyo uploads), which
// already use AbortSignal.timeout(...) for exactly this reason.
function findOpenAiFetchCalls(source) {
  const calls = [];
  const pattern = /fetch\(\s*"https:\/\/api\.openai\.com\/[^"]+"/g;
  let match;
  while ((match = pattern.exec(source))) {
    calls.push(match.index);
  }
  return calls;
}

test("api/campaign/brain.js makes exactly five direct OpenAI fetch calls", () => {
  const calls = findOpenAiFetchCalls(apiSource);
  assert.equal(calls.length, 5, `expected 5 direct OpenAI fetch call sites, found ${calls.length}`);
});

test("every direct OpenAI fetch call site passes a bounded AbortSignal.timeout", () => {
  const calls = findOpenAiFetchCalls(apiSource);
  assert.ok(calls.length > 0, "no OpenAI fetch call sites found — has the endpoint moved?");

  for (const startIndex of calls) {
    // The fetch options object for each of these call sites closes well within a few hundred
    // characters; slicing a fixed window keeps this robust to reordering of sibling keys.
    const window = apiSource.slice(startIndex, startIndex + 600);
    const signalMatch = window.match(/signal:\s*AbortSignal\.timeout\((\d+(?:_\d+)*)\)/);
    assert.ok(
      signalMatch,
      `OpenAI fetch call at offset ${startIndex} is missing a signal: AbortSignal.timeout(...) — ` +
        `context:\n${window.slice(0, 200)}`
    );

    const timeoutMs = Number(signalMatch[1].replace(/_/g, ""));
    assert.ok(
      timeoutMs >= 30_000 && timeoutMs <= 250_000,
      `OpenAI fetch call at offset ${startIndex} has an unreasonable timeout: ${timeoutMs}ms ` +
        `(expected something generous enough for a real response but well inside the 300s function budget)`
    );
  }
});

test("generate_email_visuals wraps its per-image OpenAI call in its own try/catch (timeouts surface as per-item errors)", () => {
  const start = apiSource.indexOf('action === "generate_email_visuals"');
  const end = apiSource.indexOf('action === "generate_environment_series"', start);
  assert.ok(start !== -1 && end !== -1 && end > start, "could not locate the generate_email_visuals action block");
  const block = apiSource.slice(start, end);

  const tryIndex = block.indexOf("try {");
  const fetchIndex = block.indexOf('fetch("https://api.openai.com/v1/images/edits"');
  const catchIndex = block.indexOf("image: null,", fetchIndex);

  assert.ok(tryIndex !== -1 && tryIndex < fetchIndex, "the image-edit fetch is not inside a try block");
  assert.ok(fetchIndex !== -1, "generate_email_visuals no longer calls the images/edits endpoint");
  assert.ok(catchIndex !== -1, "the image-edit fetch's surrounding catch (mapping to a per-item error) could not be found");
  assert.match(block.slice(catchIndex, catchIndex + 200), /error:\s*\{\s*role:\s*entry\.role,\s*error:/);
});

test("generate_environment_series wraps its per-image OpenAI call in its own try/catch (timeouts surface as per-item errors)", () => {
  const start = apiSource.indexOf('action === "generate_environment_series"');
  assert.ok(start !== -1, "could not locate the generate_environment_series action block");
  const end = apiSource.indexOf("if (!input.objective", start);
  const block = apiSource.slice(start, end === -1 ? undefined : end);

  const tryIndex = block.indexOf("try {");
  const fetchIndex = block.indexOf('fetch("https://api.openai.com/v1/images/edits"');
  const catchIndex = block.indexOf("} catch (error) {", fetchIndex);

  assert.ok(tryIndex !== -1 && tryIndex < fetchIndex, "the image-edit fetch is not inside a try block");
  assert.ok(fetchIndex !== -1, "generate_environment_series no longer calls the images/edits endpoint");
  assert.ok(catchIndex !== -1, "the image-edit fetch's surrounding catch could not be found");
  assert.match(block.slice(catchIndex, catchIndex + 300), /generationErrors\.push/);
});
