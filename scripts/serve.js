/**
 * Static dev server.
 *
 * Replaces `python3 -m http.server`, which sends no cache headers. Browsers
 * then heuristically cache ES modules, and because a module's URL never changes
 * on a no-build site, edits appear not to take effect. That cost real debugging
 * time three separate times — twice leading to the wrong conclusion that a fix
 * hadn't worked — so the server now sends `no-store` and the problem is gone.
 *
 * Serves the repository root, because the page fetches ../data/events.json.
 *
 * Usage: node scripts/serve.js [port]
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.argv[2] ?? 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  // Resolve inside ROOT only — a path like /../../etc/passwd must not escape.
  const target = resolve(ROOT, normalize(pathname).replace(/^([/\\])+/, ""));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    const body = await readFile(file);

    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      // The whole point: never let the browser hold a stale module.
      "Cache-Control": "no-store, must-revalidate",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}/src/`);
});
