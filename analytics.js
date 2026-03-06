// ============================================================
// analytics.js  –  Human-first analytics for Amit Weis portfolio
// Requires: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
//           stored in window.ANALYTICS_CONFIG (injected server-side)
//           OR set directly below for static deployments via a
//           thin Vercel Edge Function proxy (see README comment).
//
// HOW TO USE:
//   1. Deploy the proxy edge function (analytics-proxy/route.js)
//   2. Add <script src="/analytics.js"></script> to every page
//   3. The script auto-detects the page and tracks accordingly
// ============================================================

(function () {
  "use strict";

  // ── Config ──────────────────────────────────────────────────
  // Point this at your Vercel Edge Function proxy so your
  // Upstash token is never exposed in the browser.
  const PROXY_URL = "/api/analytics";

  // ── Bot / Human Detection ────────────────────────────────────
  function getBotScore() {
    let score = 0; // higher = more bot-like

    // No JS execution time variance (headless browsers are very fast)
    const start = performance.now();
    let x = 0;
    for (let i = 0; i < 1000; i++) x += Math.random();
    const elapsed = performance.now() - start;
    if (elapsed < 0.5) score += 2;

    // Suspiciously small or zero screen
    if (screen.width === 0 || screen.height === 0) score += 3;
    if (screen.width < 200 || screen.height < 200) score += 2;

    // No plugins (headless Chrome has none)
    if (navigator.plugins.length === 0) score += 1;

    // Webdriver flag
    if (navigator.webdriver) score += 5;

    // No touch AND no mouse movement recorded = likely bot
    // (checked later via interaction listener)

    // Languages missing
    if (!navigator.languages || navigator.languages.length === 0) score += 2;

    // Unusual user-agent patterns
    const ua = navigator.userAgent.toLowerCase();
    const botPatterns =
      /bot|crawl|spider|slurp|baiduspider|googlebot|bingbot|yandex|duckduckbot|facebookexternalhit|linkedinbot|twitterbot|ahrefsbot|semrushbot|wget|curl|python-requests|scrapy/;
    if (botPatterns.test(ua)) score += 10;

    return score;
  }

  function isHuman() {
    return getBotScore() < 4;
  }

  // ── Fingerprint (non-invasive session ID) ────────────────────
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

  // ── Country / region from timezone (no IP lookup needed) ─────
  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      return "unknown";
    }
  }

  // ── Send event to proxy ──────────────────────────────────────
  async function track(event, payload = {}) {
    const body = {
      event,
      page: window.location.pathname,
      sessionId: getSessionId(),
      isHuman: isHuman(),
      botScore: getBotScore(),
      timezone: getTimezone(),
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
      // silently fail – never break the site for analytics
    }
  }

  // ── Page view ────────────────────────────────────────────────
  track("pageview");

  // ── Interaction signal (upgrade session to "confirmed human") ─
  let interactionRecorded = false;
  function recordInteraction() {
    if (interactionRecorded) return;
    interactionRecorded = true;
    track("interaction"); // user moved mouse or touched screen
  }
  window.addEventListener("mousemove", recordInteraction, { once: true });
  window.addEventListener("touchstart", recordInteraction, { once: true });
  window.addEventListener("keydown", recordInteraction, { once: true });

  // ── Time on page ─────────────────────────────────────────────
  const pageStart = Date.now();
  window.addEventListener("beforeunload", function () {
    const seconds = Math.round((Date.now() - pageStart) / 1000);
    track("timeonpage", { seconds });
  });

  // ── Portfolio item expand tracking ───────────────────────────
  // Works with your existing portfolio.js expand/collapse logic.
  // Observes clicks on .portfolio-item-header elements.
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

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachPortfolioTracking);
  } else {
    attachPortfolioTracking();
  }

  // ── Resume download tracking ─────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    const resumeBtn = document.getElementById("resume-button");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", function () {
        track("resume_download");
      });
    }
  });
})();
