// api/analytics.js  –  Vercel Serverless Function (Node.js)
// ============================================================
// Place this file at: /api/analytics.js in your project root.
//
// Set these environment variables in your Vercel project dashboard:
//   UPSTASH_REDIS_REST_URL   → from Upstash console
//   UPSTASH_REDIS_REST_TOKEN → from Upstash console
//
// This proxy:
//   1. Receives events from analytics.js in the browser
//   2. Forwards them to Upstash Redis
//   3. Never exposes your token to the client
// ============================================================

export const config = {
  runtime: "edge",
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Helper: call Upstash REST API
async function redis(command) {
  const res = await fetch(`${UPSTASH_URL}/${command.join("/")}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  return res.json();
}

// Helper: pipeline (multiple commands at once)
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
    timezone,
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

  // ── Date keys ────────────────────────────────────────────────
  const now = new Date(ts || Date.now());
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const humanLabel = isHuman ? "human" : "bot";

  const commands = [];

  // ── Store full event in a Redis Stream (last 5000 events) ────
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
    "tz",
    timezone || "",
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
    // Daily totals (human vs bot)
    commands.push(["HINCRBY", `visits:daily:${dateKey}`, humanLabel, "1"]);
    // All-time totals
    commands.push(["HINCRBY", "visits:total", humanLabel, "1"]);
    // Per-page counts
    commands.push(["HINCRBY", `page:${page || "/"}`, humanLabel, "1"]);
    // Timezone distribution
    if (timezone) {
      commands.push(["ZINCRBY", "timezones", "1", timezone]);
    }
    // Referrer distribution
    commands.push(["ZINCRBY", "referrers", "1", referrer || "direct"]);
  }

  if (event === "interaction") {
    // Upgrade session – mark this session as confirmed human
    commands.push(["SADD", `confirmed_humans:${dateKey}`, sessionId]);
    commands.push(["EXPIRE", `confirmed_humans:${dateKey}`, 60 * 60 * 24 * 90]); // 90 days
  }

  if (event === "project_expand" && project) {
    // Track which projects get expanded
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
    // Store average time on page (running sum + count for rolling average)
    commands.push(["HINCRBYFLOAT", "timeonpage", "sum", String(seconds)]);
    commands.push(["HINCRBY", "timeonpage", "count", "1"]);
  }

  try {
    await redisPipeline(commands);
  } catch (err) {
    console.error("Upstash error:", err);
    // Return 200 anyway – don't break the user's experience
  }

  return new Response("ok", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain",
    },
  });
}
