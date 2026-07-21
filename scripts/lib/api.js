/**
 * Memory Alpha MediaWiki API client.
 *
 * Rate-limited and cache-backed: every page fetched is written to
 * data/events.raw.json (gitignored), and cached pages are never re-fetched
 * unless the caller explicitly forces a refresh. Re-running the pipeline
 * should cost zero network requests.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE_PATH = resolve(ROOT, "data/events.raw.json");

const API = "https://memory-alpha.fandom.com/api.php";
const USER_AGENT = "startrek-tl/0.1 (personal project; contact via repo owner)";

/** Minimum milliseconds between network requests. Be a good citizen. */
const RATE_LIMIT_MS = 1000;

let cache = null;
let lastRequest = 0;

async function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

async function saveCache() {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");
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
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<string|null>}
 */
export async function fetchWikitext(title, { force = false } = {}) {
  const store = await loadCache();
  if (!force && title in store) return store[title];

  await throttle();

  const url = new URL(API);
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
  // Missing pages come back as a structured error, not an HTTP failure.
  const wikitext = body.error ? null : body.parse.wikitext;

  store[title] = wikitext;
  await saveCache();
  return wikitext;
}

/** True if the page is already cached locally. */
export async function isCached(title) {
  return title in (await loadCache());
}
