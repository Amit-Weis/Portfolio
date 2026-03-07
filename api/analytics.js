// api/analytics.js  –  Vercel Edge Function (proxy + wipe)
// ============================================================
// POST /api/analytics          → track an event
// POST /api/analytics?wipe=1   → wipe all Redis data (requires token)
//
// Env vars:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   DASHBOARD_SECRET  (used to authorise wipe)
// ============================================================

export const config = {
  runtime: "edge",
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET;

async function redisPipeline(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  return res.json();
}

async function redisSingle(command) {
  const res = await fetch(
    `${UPSTASH_URL}/${command.map(encodeURIComponent).join("/")}`,
    { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } },
  );
  return res.json();
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);

  // ── Wipe all analytics data ──────────────────────────────────────
  if (url.searchParams.get("wipe") === "1") {
    const token = url.searchParams.get("token");
    if (!token || token !== DASHBOARD_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      // Get all keys and delete them
      const keysRes = await redisSingle(["KEYS", "*"]);
      const keys = keysRes?.result || [];
      if (keys.length > 0) {
        const delCommands = keys.map((k) => ["DEL", k]);
        await redisPipeline(delCommands);
      }
    } catch (err) {
      console.error("Wipe error:", err);
      return new Response(JSON.stringify({ error: "Wipe failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ wiped: true }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }

  // ── Track event ──────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return new Response("Bad Request", { status: 400 });
  }

  const {
    event,
    page,
    sessionId,
    isHuman,
    botScore,
    region, // replaces timezone — already formatted by analytics.js
    referrer,
    screenW,
    screenH,
    ts,
    project,
    seconds,
  } = body;

  if (!event || !sessionId) {
    return new Response("Bad Request", { status: 400 });
  }

  const now = new Date(ts || Date.now());
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const humanLabel = isHuman ? "human" : "bot";

  const commands = [];

  // Store full event in a Redis Stream (last 5000 events)
  const streamEntry = [
    "event",
    event,
    "page",
    page || "",
    "session",
    sessionId,
    "human",
    String(isHuman),
    "botScore",
    String(botScore || 0),
    "region",
    region || "",
    "ref",
    referrer || "direct",
    "sw",
    String(screenW || 0),
    "sh",
    String(screenH || 0),
    "ts",
    String(ts || Date.now()),
    ...(project ? ["project", project] : []),
    ...(seconds !== undefined ? ["seconds", String(seconds)] : []),
  ];

  commands.push(["XADD", "events", "MAXLEN", "~", "5000", "*", ...streamEntry]);

  if (event === "pageview") {
    commands.push(["HINCRBY", `visits:daily:${dateKey}`, humanLabel, "1"]);
    commands.push(["HINCRBY", "visits:total", humanLabel, "1"]);
    commands.push(["HINCRBY", `page:${page || "/"}`, humanLabel, "1"]);
    // Region distribution (replaces raw timezone)
    if (region && region !== "Unknown") {
      commands.push(["ZINCRBY", "regions", "1", region]);
    }
  }

  if (event === "interaction") {
    commands.push(["SADD", `confirmed_humans:${dateKey}`, sessionId]);
    commands.push(["EXPIRE", `confirmed_humans:${dateKey}`, 60 * 60 * 24 * 90]);
  }

  if (event === "project_expand" && project) {
    commands.push(["ZINCRBY", "project_clicks", "1", project]);
    commands.push(["ZINCRBY", `project_clicks:${dateKey}`, "1", project]);
  }

  if (event === "resume_download") {
    commands.push(["HINCRBY", "visits:total", "resume_downloads", "1"]);
    commands.push([
      "HINCRBY",
      `visits:daily:${dateKey}`,
      "resume_downloads",
      "1",
    ]);
  }

  if (event === "timeonpage" && seconds !== undefined) {
    commands.push(["HINCRBYFLOAT", "timeonpage", "sum", String(seconds)]);
    commands.push(["HINCRBY", "timeonpage", "count", "1"]);
  }

  try {
    await redisPipeline(commands);
  } catch (err) {
    console.error("Upstash error:", err);
  }

  return new Response("ok", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain",
    },
  });
}
