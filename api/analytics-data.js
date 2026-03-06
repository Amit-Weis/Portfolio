// api/analytics-data.js  –  Vercel Serverless Function
// ============================================================
// Serves aggregated analytics data to the dashboard.
// Protected by a simple secret token in the URL:
//   /api/analytics-data?token=YOUR_DASHBOARD_SECRET
//
// Add DASHBOARD_SECRET to your Vercel environment variables.
// ============================================================

export const config = {
  runtime: "edge",
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET;

async function redis(commands) {
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
    {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    },
  );
  const data = await res.json();
  return data.result;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token !== DASHBOARD_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Build last 30 days of date keys
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push(key);
  }

  const commands = [
    // All-time totals
    ["HGETALL", "visits:total"],
    // Project click leaderboard (all time)
    ["ZREVRANGE", "project_clicks", "0", "-1", "WITHSCORES"],
    // Top timezones
    ["ZREVRANGE", "timezones", "0", "19", "WITHSCORES"],
    // Top referrers
    ["ZREVRANGE", "referrers", "0", "9", "WITHSCORES"],
    // Time on page stats
    ["HGETALL", "timeonpage"],
    // Daily data for each of the 30 days
    ...days.map((d) => ["HGETALL", `visits:daily:${d}`]),
  ];

  let results;
  try {
    results = await redis(commands);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Redis error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse results
  const parseHash = (arr) => {
    if (!arr || !Array.isArray(arr)) return {};
    const obj = {};
    for (let i = 0; i < arr.length; i += 2) obj[arr[i]] = arr[i + 1];
    return obj;
  };

  const parseZset = (arr) => {
    if (!arr || !Array.isArray(arr)) return [];
    const out = [];
    for (let i = 0; i < arr.length; i += 2) {
      out.push({ name: arr[i], count: parseInt(arr[i + 1], 10) });
    }
    return out;
  };

  const totals = parseHash(results[0]?.result);
  const projectClicks = parseZset(results[1]?.result);
  const timezones = parseZset(results[2]?.result);
  const referrers = parseZset(results[3]?.result);
  const timeonpage = parseHash(results[4]?.result);
  const dailyRaw = results.slice(5).map((r, i) => ({
    date: days[i],
    ...parseHash(r?.result),
  }));

  const avgTime =
    timeonpage.count && timeonpage.sum
      ? Math.round(parseFloat(timeonpage.sum) / parseInt(timeonpage.count, 10))
      : 0;

  return new Response(
    JSON.stringify({
      totals,
      projectClicks,
      timezones,
      referrers,
      avgTimeOnPage: avgTime,
      daily: dailyRaw,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
