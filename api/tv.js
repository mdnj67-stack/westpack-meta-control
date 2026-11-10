// The office TV's data feed. The TV (the wood stove, its programme, its Westpack facts and its own
// sign-in) is a separate project: westpack-tv, C:\Projects\westpack-tv. This route only hands it the
// live figures that need this app's stores and keys.
//
//   GET kpis - the scenes, ready to render. Server to server with `Authorization: Bearer <TV_FEED_TOKEN>`,
//              or with a normal session. `&fresh=1` skips the ten-minute cache; Klaviyo is still asked
//              at most every three hours.
//
// Read-only towards Meta and Klaviyo. It makes no Graph call at all: the Meta figures are the ones the
// dashboard stored when it last built a snapshot. The only writes are the TV's own documents in Blob
// (tv/kpis.json, tv/subscriber-daily.json). See server/tv/kpi-sources.js.

const { getConfig } = require("../server/lib/config");
const { sendJson } = require("../server/lib/http");
const { resolveFeedAccess } = require("../server/tv/feed-auth");
const { getTvKpis } = require("../server/tv/kpi-sources");

module.exports = async (req, res) => {
  const config = getConfig();
  const action = String(req.query?.action || "").trim().toLowerCase();
  res.setHeader("Cache-Control", "no-store");

  try {
    if (action === "kpis") {
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return sendJson(res, 405, { error: "Method not allowed." });
      }
      if (resolveFeedAccess(req, config) === null) return sendJson(res, 401, { error: "Authentication required." });
      const { payload } = await getTvKpis({ config, fresh: String(req.query?.fresh || "") === "1" });
      return sendJson(res, 200, payload);
    }
    return sendJson(res, 400, { error: "Unsupported TV action." });
  } catch (error) {
    return sendJson(res, Number(error?.statusCode) || 500, { error: error?.message || "The TV request failed." });
  }
};
