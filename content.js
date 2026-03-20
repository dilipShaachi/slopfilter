// SlopFilter — Content Script
// Scans page text and scores blocks for AI-generated content.

(() => {
  "use strict";

  // --- Constants ---

  const FILLER_PHRASES = [
    "in conclusion",
    "it is important to note",
    "dive into",
    "delve into",
    "it is worth noting",
    "as an ai language model",
    "certainly!",
    "absolutely!",
    "in today's fast-paced",
    "in todays fast-paced",
    "game-changer",
    "game changer",
    "leverage",
    "transformative",
    "at the end of the day",
    "needless to say",
    "rest assured",
    "it's important to remember",
    "without further ado",
    "in this article",
    "let's explore",
    "here's the thing",
    "the reality is",
    "when it comes to",
    "in the world of",
    "whether you're a",
    "you might be wondering",
    "the good news is",
    "first and foremost",
    "last but not least",
    "at its core",
    "a comprehensive guide",
    "unlock the power",
    "take it to the next level",
    "harness the potential",
    "navigate the complexities",
    "foster a sense of",
    "tapestry",
    "multifaceted",
    "holistic approach",
    "paradigm shift",
    "robust and scalable",
    "cutting-edge",
    "ever-evolving",
    "in the realm of",
    "landscape",
    "moreover",
    "furthermore",
    "encompasses"
  ];

  const STYLE_ID = "slopfilter-styles";
  const ATTR_SCORE = "data-slop-score";
  const ATTR_PROCESSED = "data-slop-processed";
  const MIN_TEXT_LENGTH = 80;

  let settings = {
    enabled: true,
    mode: "dim",
    sensitivity: "medium"
  };

  let filteredCount = 0;
  let debounceTimer = null;

  // --- Sensitivity thresholds ---

  function getThreshold() {
    switch (settings.sensitivity) {
      case "low": return 75;
      case "high": return 45;
      default: return 60;
    }
  }

  // --- Scoring engine ---

  function scoreSlopPhrase(text) {
    const lower = text.toLowerCase();
    let hits = 0;
    for (const phrase of FILLER_PHRASES) {
      if (lower.includes(phrase)) hits++;
    }
    // Scale: each hit is worth ~12 points, capped contribution at 50
    return Math.min(hits * 12, 50);
  }

  function scoreSentenceLengthVariance(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
    if (sentences.length < 3) return 0;
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
    const cv = Math.sqrt(variance) / (mean || 1); // coefficient of variation
    // Low CV = suspiciously uniform. CV < 0.2 is very uniform.
    if (cv < 0.15) return 25;
    if (cv < 0.25) return 15;
    if (cv < 0.35) return 8;
    return 0;
  }

  function scoreEmDashesAndBullets(text) {
    const emDashes = (text.match(/\u2014|--/g) || []).length;
    const bullets = (text.match(/^\s*[\u2022\u2023\u25E6\-\*]\s/gm) || []).length;
    let score = 0;
    // More than 3 em-dashes per block is unusual for human writing
    if (emDashes >= 4) score += 12;
    else if (emDashes >= 2) score += 6;
    // Bullets in running text
    if (bullets >= 3) score += 10;
    return Math.min(score, 20);
  }

  function scoreRepetitiveParagraphOpeners(text) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    if (paragraphs.length < 3) return 0;
    const openers = paragraphs.map(p => {
      const firstWord = p.trim().split(/\s+/)[0].toLowerCase();
      return firstWord;
    });
    const counts = {};
    for (const w of openers) {
      counts[w] = (counts[w] || 0) + 1;
    }
    const maxRepeat = Math.max(...Object.values(counts));
    const ratio = maxRepeat / openers.length;
    if (ratio >= 0.6) return 15;
    if (ratio >= 0.4) return 8;
    return 0;
  }

  function scoreStructuredLists(text) {
    // Look for numbered or bulleted lists with 3-5 items of similar structure
    const listItems = text.match(/^\s*(\d+[\.\)]\s|[\-\*\u2022]\s).+/gm);
    if (!listItems || listItems.length < 3 || listItems.length > 5) return 0;
    // Check structural similarity — similar lengths?
    const lengths = listItems.map(i => i.trim().length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
    const cv = Math.sqrt(variance) / (mean || 1);
    if (cv < 0.3) return 15;
    if (cv < 0.5) return 8;
    return 0;
  }

  function scoreBlock(text) {
    if (text.length < MIN_TEXT_LENGTH) return 0;
    let total = 0;
    total += scoreSlopPhrase(text);
    total += scoreSentenceLengthVariance(text);
    total += scoreEmDashesAndBullets(text);
    total += scoreRepetitiveParagraphOpeners(text);
    total += scoreStructuredLists(text);
    return Math.min(total, 100);
  }

  // --- DOM operations ---

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [${ATTR_SCORE}][data-slop-dim="true"] {
        opacity: 0.3 !important;
        transition: opacity 0.3s ease;
      }
      [${ATTR_SCORE}][data-slop-dim="true"]:hover {
        opacity: 1 !important;
      }
      [${ATTR_SCORE}][data-slop-hide="true"] {
        position: relative !important;
        max-height: 0 !important;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
      }
      .slopfilter-show-toggle {
        display: block;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 4px;
        padding: 6px 12px;
        margin: 4px 0;
        cursor: pointer;
        font-size: 12px;
        color: #92400e;
        font-family: system-ui, sans-serif;
      }
      .slopfilter-show-toggle:hover {
        background: #fde68a;
      }
    `;
    document.head.appendChild(style);
  }

  function removeStyles() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function clearAllMarkers() {
    const marked = document.querySelectorAll(`[${ATTR_SCORE}]`);
    for (const el of marked) {
      el.removeAttribute(ATTR_SCORE);
      el.removeAttribute(ATTR_PROCESSED);
      el.removeAttribute("data-slop-dim");
      el.removeAttribute("data-slop-hide");
    }
    const toggles = document.querySelectorAll(".slopfilter-show-toggle");
    for (const t of toggles) t.remove();
    filteredCount = 0;
  }

  function applyFilter(el, score) {
    el.setAttribute(ATTR_SCORE, score);
    el.setAttribute(ATTR_PROCESSED, "true");

    if (settings.mode === "dim") {
      el.setAttribute("data-slop-dim", "true");
      el.removeAttribute("data-slop-hide");
    } else if (settings.mode === "hide") {
      el.removeAttribute("data-slop-dim");
      el.setAttribute("data-slop-hide", "true");

      // Add "Show anyway" toggle if not already present
      if (!el.nextElementSibling || !el.nextElementSibling.classList.contains("slopfilter-show-toggle")) {
        const toggle = document.createElement("button");
        toggle.className = "slopfilter-show-toggle";
        toggle.textContent = `\u26A0 AI content hidden (score: ${score}) \u2014 Show anyway`;
        toggle.addEventListener("click", () => {
          el.removeAttribute("data-slop-hide");
          toggle.textContent = "\u26A0 AI content shown \u2014 Hide again";
          toggle.addEventListener("click", function rehide() {
            el.setAttribute("data-slop-hide", "true");
            toggle.textContent = `\u26A0 AI content hidden (score: ${score}) \u2014 Show anyway`;
            toggle.removeEventListener("click", rehide);
          }, { once: true });
        }, { once: true });
        el.parentNode.insertBefore(toggle, el.nextSibling);
      }
    }
  }

  function getTextBlocks() {
    const selectors = "p, article, .post-content, .entry-content, .comment-body, blockquote, [role='main'] div, td, li";
    return document.querySelectorAll(selectors);
  }

  function scanPage() {
    if (!settings.enabled) return;

    const threshold = getThreshold();
    const blocks = getTextBlocks();
    let newCount = 0;

    for (const block of blocks) {
      if (block.getAttribute(ATTR_PROCESSED)) continue;
      // Skip very short blocks and our own UI elements
      const text = block.innerText || "";
      if (text.length < MIN_TEXT_LENGTH) continue;
      if (block.classList.contains("slopfilter-show-toggle")) continue;
      // Skip if any ancestor is already scored (avoid double-scoring nested elements)
      if (block.closest(`[${ATTR_SCORE}]`)) {
        block.setAttribute(ATTR_PROCESSED, "true");
        continue;
      }

      const score = scoreBlock(text);
      block.setAttribute(ATTR_PROCESSED, "true");

      if (score >= threshold) {
        applyFilter(block, score);
        newCount++;
      }
    }

    filteredCount += newCount;
    if (newCount > 0) {
      chrome.runtime.sendMessage({ type: "updateStats", count: newCount });
    }
  }

  // --- Initialization ---

  function init() {
    chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response) {
        settings.enabled = response.enabled;
        settings.mode = response.mode;
        settings.sensitivity = response.sensitivity;

        // Check whitelist
        const hostname = window.location.hostname;
        if (response.whitelist && response.whitelist.includes(hostname)) {
          settings.enabled = false;
        }
      }

      if (!settings.enabled) {
        removeStyles();
        clearAllMarkers();
        return;
      }

      injectStyles();
      scanPage();
      observeMutations();
      observeScroll();
    });
  }

  // --- MutationObserver for dynamic content ---

  function observeMutations() {
    const observer = new MutationObserver((mutations) => {
      let hasNewNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) {
        debouncedScan();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Debounced scroll scanning ---

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => scanPage(), 300);
  }

  function observeScroll() {
    window.addEventListener("scroll", debouncedScan, { passive: true });
  }

  // --- Message listener for popup communication ---

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "getPageCount") {
      sendResponse({ count: filteredCount });
      return;
    }
    if (message.type === "settingsUpdated") {
      settings.enabled = message.settings.enabled;
      settings.mode = message.settings.mode;
      settings.sensitivity = message.settings.sensitivity;

      const hostname = window.location.hostname;
      if (message.settings.whitelist && message.settings.whitelist.includes(hostname)) {
        settings.enabled = false;
      }

      clearAllMarkers();
      removeStyles();
      if (settings.enabled) {
        injectStyles();
        // Re-mark all processed blocks as unprocessed so they get re-scanned
        const processed = document.querySelectorAll(`[${ATTR_PROCESSED}]`);
        for (const el of processed) el.removeAttribute(ATTR_PROCESSED);
        scanPage();
      }
    }
  });

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
