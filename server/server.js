// Webserver für Azure App Service: liefert die fertige Website aus _site aus
// und stellt unter /api/cms die Schnittstelle für das CMS bereit. Keine Abhängigkeiten nötig.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { benutzer, anmeldeSeite, keinZugriffSeite } from "./anmeldung.js";
import { cmsAktion } from "./cms-backend.js";

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
const MAX_ANFRAGE = 25 * 1024 * 1024; // Bild-Uploads kommen Base64-kodiert

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

function json(req, res, status, daten) {
  senden(req, res, status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, JSON.stringify(daten));
}

function koerperLesen(req) {
  return new Promise((resolve, reject) => {
    const teile = [];
    let groesse = 0;
    req.on("data", (teil) => {
      groesse += teil.length;
      if (groesse > MAX_ANFRAGE) {
        reject(Object.assign(new Error("Datei zu groß (max. ca. 18 MB)."), { status: 413 }));
        req.destroy();
      } else teile.push(teil);
    });
    req.on("end", () => resolve(Buffer.concat(teile).toString("utf8")));
    req.on("error", reject);
  });
}

async function cmsSchnittstelle(req, res) {
  const b = benutzer(req);
  if (!b) return json(req, res, 401, { error: "Bitte melden Sie sich erneut an." });
  if (!b.erlaubt) return json(req, res, 403, { error: "Keine Berechtigung zum Bearbeiten der Website." });
  if (req.method !== "POST") return json(req, res, 405, { error: "Nur POST erlaubt." });
  try {
    const { action, params } = JSON.parse(await koerperLesen(req));
    const ergebnis = await cmsAktion(action, params, b);
    if (["persistEntry", "persistMedia", "deleteFile", "deleteFiles"].includes(action)) {
      console.log(`CMS: ${action} durch ${b.email}`);
    }
    json(req, res, 200, ergebnis);
  } catch (err) {
    console.error("CMS-Fehler:", err.message);
    json(req, res, err.status && err.status < 500 ? err.status : 500, {
      error: err.status && err.status < 500 ? err.message : "Speichern fehlgeschlagen – bitte in einer Minute erneut versuchen.",
    });
  }
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

    if (url.pathname === "/api/cms") return cmsSchnittstelle(req, res);

    // Redaktionsbereich nur für angemeldete und freigeschaltete Personen
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const b = benutzer(req);
      const htmlSeite = (status, body) =>
        senden(req, res, status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body);
      if (!b) return url.pathname === "/admin/" || url.pathname === "/admin" ? htmlSeite(200, anmeldeSeite()) : htmlSeite(401, anmeldeSeite());
      if (!b.erlaubt) return htmlSeite(403, keinZugriffSeite(b));
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
