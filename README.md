# SlopFilter

**50% of what you read online today was written by AI. SlopFilter is the ad blocker for it.**

The internet is drowning in AI-generated slop — formulaic blog posts, SEO filler, ChatGPT-flavored corporate nothing-speak. It sounds confident. It says nothing. And it's everywhere.

SlopFilter is a browser extension that detects likely AI-generated text using linguistic heuristics and lets you dim it, hide it, or ignore it. No cloud APIs. No data leaves your browser. It just works.

Think of it as **uBlock Origin for AI content**.

## How It Works

SlopFilter scores text blocks (paragraphs, articles, comments) from 0-100 based on:

- **Filler phrase detection** — "It is important to note", "delve into", "game-changer", "in today's fast-paced world", and 40+ other telltale AI phrases
- **Sentence uniformity** — AI writes suspiciously even-length sentences. Humans don't.
- **Em-dash and bullet abuse** — the hallmark of LLM prose
- **Repetitive paragraph openers** — "The... The... The... This... This..."
- **Structured list patterns** — exactly 3-5 items with matching structure

Score 60+ = likely AI. Score 80+ = almost certainly AI.

## Modes

| Mode | What it does |
|------|-------------|
| **Dim** | Reduces flagged content to 30% opacity. Hover to read. (Default) |
| **Hide** | Collapses flagged blocks. Click "Show anyway" to reveal. |
| **Off** | Disabled. No filtering. |

## Install

### Chrome
1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this folder

### Firefox
This extension uses Manifest V3. Firefox supports MV3 as of Firefox 109+.

To load in Firefox:
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from this folder

**Note:** Firefox uses `browser.*` APIs instead of `chrome.*`. This extension uses `chrome.*` which Firefox polyfills in MV3 mode. If you hit issues, you may need the [webextension-polyfill](https://github.com/nicolo-ribaudo/webextension-polyfill).

## Configuration

**Popup controls:**
- On/Off toggle
- Mode selector (Dim / Hide)
- Sensitivity slider (Low / Medium / High)
- Live count of filtered blocks on current page

**Options page:**
- Whitelist specific domains
- View lifetime filter stats

## Technical Details

- Pure JavaScript — no build step, no npm, no dependencies
- Manifest V3 (Chrome-native, Firefox-compatible)
- Content script injects styles via `<style>` tag — does NOT modify DOM structure
- Uses `chrome.storage.sync` for settings
- `MutationObserver` for dynamic/SPA pages
- Debounced detection on scroll
- All detection runs locally in your browser

## Philosophy

AI text isn't inherently bad. But undisclosed AI text pretending to be human thought is pollution. SlopFilter doesn't block AI — it gives you the choice to see it or not. Your attention, your rules.

## License

MIT
