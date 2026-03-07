// ============================================================
// analytics.js  –  Human-first analytics for Amit Weis portfolio
// Requires: Vercel Edge Function proxy at /api/analytics
// ============================================================

(function () {
  "use strict";

  const PROXY_URL = "/api/analytics";

  // ── Bot / Human Detection ──────────────────────────────────────────
  function getBotScore() {
    let score = 0;

    const start = performance.now();
    let x = 0;
    for (let i = 0; i < 1000; i++) x += Math.random();
    const elapsed = performance.now() - start;
    if (elapsed < 0.5) score += 2;

    if (screen.width === 0 || screen.height === 0) score += 3;
    if (screen.width < 200 || screen.height < 200) score += 2;
    if (navigator.plugins.length === 0) score += 1;
    if (navigator.webdriver) score += 5;
    if (!navigator.languages || navigator.languages.length === 0) score += 2;

    const ua = navigator.userAgent.toLowerCase();
    const botPatterns =
      /bot|crawl|spider|slurp|baiduspider|googlebot|bingbot|yandex|duckduckbot|facebookexternalhit|linkedinbot|twitterbot|ahrefsbot|semrushbot|wget|curl|python-requests|scrapy/;
    if (botPatterns.test(ua)) score += 10;

    return score;
  }

  function isHuman() {
    return getBotScore() < 4;
  }

  // ── Self-exclusion ─────────────────────────────────────────────────
  function isSelf() {
    return document.cookie.split(";").some((c) => c.trim() === "aw_no_track=1");
  }

  // ── Session ID ─────────────────────────────────────────────────────
  function getSessionId() {
    let sid = sessionStorage.getItem("_asid");
    if (!sid) {
      sid =
        Math.random().toString(36).slice(2) +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2);
      sessionStorage.setItem("_asid", sid);
    }
    return sid;
  }

  // ── Geo: country + province/state for CA/US ────────────────────────
  // Uses timezone to infer region without any IP lookup.
  function getGeoRegion() {
    let tz = "unknown";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      return "Unknown";
    }

    // Map IANA timezone → [Country, Province/State or null]
    const tzMap = {
      // Canada
      "America/St_Johns": ["Canada", "Newfoundland"],
      "America/Halifax": ["Canada", "Nova Scotia"],
      "America/Glace_Bay": ["Canada", "Nova Scotia"],
      "America/Moncton": ["Canada", "New Brunswick"],
      "America/Goose_Bay": ["Canada", "Newfoundland"],
      "America/Toronto": ["Canada", "Ontario"],
      "America/Nipigon": ["Canada", "Ontario"],
      "America/Thunder_Bay": ["Canada", "Ontario"],
      "America/Iqaluit": ["Canada", "Nunavut"],
      "America/Pangnirtung": ["Canada", "Nunavut"],
      "America/Winnipeg": ["Canada", "Manitoba"],
      "America/Rainy_River": ["Canada", "Ontario"],
      "America/Resolute": ["Canada", "Nunavut"],
      "America/Rankin_Inlet": ["Canada", "Nunavut"],
      "America/Regina": ["Canada", "Saskatchewan"],
      "America/Swift_Current": ["Canada", "Saskatchewan"],
      "America/Edmonton": ["Canada", "Alberta"],
      "America/Cambridge_Bay": ["Canada", "Nunavut"],
      "America/Yellowknife": ["Canada", "Northwest Territories"],
      "America/Inuvik": ["Canada", "Northwest Territories"],
      "America/Creston": ["Canada", "British Columbia"],
      "America/Dawson_Creek": ["Canada", "British Columbia"],
      "America/Fort_Nelson": ["Canada", "British Columbia"],
      "America/Vancouver": ["Canada", "British Columbia"],
      "America/Whitehorse": ["Canada", "Yukon"],
      "America/Dawson": ["Canada", "Yukon"],
      "America/Montreal": ["Canada", "Quebec"],
      // USA — representative set
      "America/New_York": ["United States", "New York"],
      "America/Detroit": ["United States", "Michigan"],
      "America/Kentucky/Louisville": ["United States", "Kentucky"],
      "America/Indiana/Indianapolis": ["United States", "Indiana"],
      "America/Chicago": ["United States", "Illinois"],
      "America/Indiana/Knox": ["United States", "Indiana"],
      "America/Menominee": ["United States", "Michigan"],
      "America/North_Dakota/Center": ["United States", "North Dakota"],
      "America/Denver": ["United States", "Colorado"],
      "America/Boise": ["United States", "Idaho"],
      "America/Phoenix": ["United States", "Arizona"],
      "America/Los_Angeles": ["United States", "California"],
      "America/Anchorage": ["United States", "Alaska"],
      "America/Juneau": ["United States", "Alaska"],
      "America/Sitka": ["United States", "Alaska"],
      "America/Metlakatla": ["United States", "Alaska"],
      "America/Yakutat": ["United States", "Alaska"],
      "America/Nome": ["United States", "Alaska"],
      "America/Adak": ["United States", "Alaska"],
      "Pacific/Honolulu": ["United States", "Hawaii"],
      "America/Boise": ["United States", "Idaho"],
      "America/Indiana/Marengo": ["United States", "Indiana"],
      "America/Indiana/Vevay": ["United States", "Indiana"],
      "America/Indiana/Tell_City": ["United States", "Indiana"],
      "America/Indiana/Vincennes": ["United States", "Indiana"],
      "America/Indiana/Petersburg": ["United States", "Indiana"],
      "America/Indiana/Winamac": ["United States", "Indiana"],
      "America/Kentucky/Monticello": ["United States", "Kentucky"],
      "America/North_Dakota/New_Salem": ["United States", "North Dakota"],
      "America/North_Dakota/Beulah": ["United States", "North Dakota"],
    };

    const entry = tzMap[tz];
    if (entry) {
      const [country, region] = entry;
      return region ? `${region}, ${country}` : country;
    }

    // Fall back: derive country name from timezone prefix
    const parts = tz.split("/");
    if (parts.length >= 2) {
      // e.g. "Europe/London" → "Europe / London" is still useful
      return tz.replace(/_/g, " ");
    }
    return tz;
  }

  // ── Send event to proxy ────────────────────────────────────────────
  async function track(event, payload = {}) {
    if (isSelf()) return;
    const body = {
      event,
      page: window.location.pathname,
      sessionId: getSessionId(),
      isHuman: isHuman(),
      botScore: getBotScore(),
      region: getGeoRegion(),
      referrer: document.referrer || "direct",
      screenW: screen.width,
      screenH: screen.height,
      ts: Date.now(),
      ...payload,
    };

    try {
      await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch (_) {
      // silently fail — never break the site for analytics
    }
  }

  // ── Page view ──────────────────────────────────────────────────────
  track("pageview");

  // ── Interaction signal ─────────────────────────────────────────────
  let interactionRecorded = false;
  function recordInteraction() {
    if (interactionRecorded) return;
    interactionRecorded = true;
    track("interaction");
  }
  window.addEventListener("mousemove", recordInteraction, { once: true });
  window.addEventListener("touchstart", recordInteraction, { once: true });
  window.addEventListener("keydown", recordInteraction, { once: true });

  // ── Active-tab time on page ────────────────────────────────────────
  // Only counts time while the tab is visible and focused.
  let activeStart = document.visibilityState === "visible" ? Date.now() : null;
  let accumulatedMs = 0;

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      // Tab became active — start timer
      activeStart = Date.now();
    } else {
      // Tab hidden — accumulate elapsed time
      if (activeStart !== null) {
        accumulatedMs += Date.now() - activeStart;
        activeStart = null;
      }
    }
  });

  window.addEventListener("beforeunload", function () {
    // Flush any remaining active time
    if (activeStart !== null) {
      accumulatedMs += Date.now() - activeStart;
    }
    const seconds = Math.round(accumulatedMs / 1000);
    if (seconds > 0) {
      track("timeonpage", { seconds });
    }
  });

  // ── Portfolio item expand tracking ─────────────────────────────────
  function attachPortfolioTracking() {
    const headers = document.querySelectorAll(".portfolio-item-header");
    headers.forEach(function (header) {
      header.addEventListener("click", function () {
        const item = header.closest(".portfolio-item");
        const title = header.querySelector(".jobTitle");
        const projectName = title ? title.textContent.trim() : "unknown";
        const isExpanding = !item.classList.contains("expanded");
        if (isExpanding) {
          track("project_expand", { project: projectName });
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachPortfolioTracking);
  } else {
    attachPortfolioTracking();
  }

  // ── Resume download tracking ───────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    const resumeBtn = document.getElementById("resume-button");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", function () {
        track("resume_download");
      });
    }
  });
})();
