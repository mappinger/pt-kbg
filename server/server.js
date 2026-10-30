// Webserver für Azure App Service: liefert die fertige Website aus _site aus
// und stellt den CMS-Login unter /api/auth und /api/callback bereit. Keine Abhängigkeiten nötig.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { auth, callback } from "./cms-auth.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), process.env.SITE_DIR || "../_site");
const PORT = process.env.PORT || 8080;

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};
const KOMPRIMIERBAR = /^(text\/|application\/(json|xml)|image\/svg)/;

// Alte WordPress-Adressen
const WEITERLEITUNGEN = [
  [/^\/feed(\/|$)/, "/"],
  [/^\/comments\/feed(\/|$)/, "/"],
  [/^\/wp-admin(\/|$)/, "/admin/"],
  [/^\/wp-login\.php$/, "/admin/"],
];

const SICHERHEIT = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=31536000",
};

function senden(req, res, status, headers, body) {
  res.writeHead(status, { ...SICHERHEIT, ...headers });
  res.end(req.method === "HEAD" ? undefined : body);
}

function dateiSenden(req, res, datei, status = 200) {
  const typ = TYPEN[path.extname(datei).toLowerCase()] || "application/octet-stream";
  const rel = path.relative(ROOT, datei).split(path.sep).join("/");
  const cache = rel.startsWith("img/") || rel.startsWith("assets/fonts/")
    ? "public, max-age=31536000, immutable"
    : typ.startsWith("text/html") || rel.startsWith("admin/")
      ? "no-cache"
      : "public, max-age=86400";
  const headers = { "Content-Type": typ, "Cache-Control": cache, Vary: "Accept-Encoding" };

  if (KOMPRIMIERBAR.test(typ) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    res.writeHead(status, { ...SICHERHEIT, ...headers, "Content-Encoding": "gzip" });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(datei).pipe(zlib.createGzip()).pipe(res);
  }
  res.writeHead(status, { ...SICHERHEIT, ...headers, "Content-Length": fs.statSync(datei).size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(datei).pipe(res);
}

function nichtGefunden(req, res) {
  const seite = path.join(ROOT, "404.html");
  if (fs.existsSync(seite)) return dateiSenden(req, res, seite, 404);
  senden(req, res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Seite nicht gefunden");
}

const server = http.createServer(async (req, res) => {
  try {
    const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0];
    const url = new URL(req.url, `${proto}://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/auth" || url.pathname === "/api/callback") {
      const r = url.pathname === "/api/auth" ? auth(url) : await callback(url, req.headers.cookie);
      return senden(req, res, r.status, r.headers, r.body);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return senden(req, res, 405, { Allow: "GET, HEAD" }, "");
    }

    for (const [muster, ziel] of WEITERLEITUNGEN) {
      if (muster.test(url.pathname)) return senden(req, res, 301, { Location: ziel }, "");
    }

    let pfad;
    try { pfad = decodeURIComponent(url.pathname); } catch { return nichtGefunden(req, res); }
    const datei = path.join(ROOT, path.normalize(pfad));
    if (datei !== ROOT && !datei.startsWith(ROOT + path.sep)) return nichtGefunden(req, res);

    const stat = fs.statSync(datei, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        return senden(req, res, 301, { Location: url.pathname + "/" + url.search }, "");
      }
      const index = path.join(datei, "index.html");
      return fs.existsSync(index) ? dateiSenden(req, res, index) : nichtGefunden(req, res);
    }
    if (stat?.isFile()) return dateiSenden(req, res, datei);
    nichtGefunden(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) senden(req, res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Serverfehler");
  }
});

server.listen(PORT, () => console.log(`Website läuft auf Port ${PORT} (${ROOT})`));
