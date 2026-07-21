/**
 * MediaWiki API client for the two sources this project draws on.
 *
 * Rate-limited and cache-backed: every page fetched is written to
 * data/events.raw.json (gitignored), and cached pages are never re-fetched
 * unless the caller explicitly forces a refresh. Re-running the pipeline
 * should cost zero network requests.
 *
 * Cache keys are namespaced by site, so "ma:2373" and "wp:2373" can't collide.
 */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE_PATH = resolve(ROOT, "data/events.raw.json");

/** Supported sources. `ma` drives event density; `wp` is the classification overlay. */
export const SITES = {
  ma: {
    api: "https://memory-alpha.fandom.com/api.php",
    wiki: "https://memory-alpha.fandom.com/wiki",
  },
  wp: {
    api: "https://en.wikipedia.org/w/api.php",
    wiki: "https://en.wikipedia.org/wiki",
  },
};

const USER_AGENT = "startrek-tl (personal project; https://github.com/haggyroth/startrek-tl)";

/** Minimum milliseconds between network requests. Be a good citizen. */
const RATE_LIMIT_MS = 1000;

let cache = null;
let lastRequest = 0;
let dirty = 0;

/**
 * Fetches between cache flushes.
 *
 * Writing the whole cache after every page made a cold run quadratic: 175
 * rewrites of a file that grows to half a megabyte. Checkpointing keeps the
 * cost linear while still bounding how much a crash can lose.
 */
const FLUSH_EVERY = 25;

async function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

/**
 * Write the cache atomically — a crash mid-write would otherwise leave a
 * truncated JSON file that the next run cannot parse, silently discarding
 * every cached page and re-scraping the whole wiki.
 */
export async function saveCache() {
  if (!cache) return;
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  const tmp = `${CACHE_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2) + "\n");
  await rename(tmp, CACHE_PATH);
  dirty = 0;
}

async function throttle() {
  const wait = RATE_LIMIT_MS - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

/**
 * Fetch the raw wikitext of a page. Returns null if the page does not exist.
 *
 * @param {string} title Page title, e.g. "2373"
 * @param {{ force?: boolean, site?: keyof SITES }} [options]
 * @returns {Promise<string|null>}
 */
export async function fetchWikitext(title, { force = false, site = "ma" } = {}) {
  const store = await loadCache();
  const key = `${site}:${title}`;
  if (!force && key in store) return store[key];

  await throttle();

  const url = new URL(SITES[site].api);
  url.search = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "wikitext",
    format: "json",
    formatversion: "2",
  }).toString();

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`);

  const body = await res.json();
  // Missing pages come back as a structured error, not an HTTP failure. Read
  // defensively: an unexpected shape should not crash a 170-page run with a
  // bare TypeError.
  const wikitext = body?.error ? null : (body?.parse?.wikitext ?? null);

  store[key] = wikitext;
  if (++dirty >= FLUSH_EVERY) await saveCache();
  return wikitext;
}

/** True if the page is already cached locally. */
export async function isCached(title, site = "ma") {
  return `${site}:${title}` in (await loadCache());
}
