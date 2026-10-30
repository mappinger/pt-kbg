// Minimaler GitHub-Client: liest Dateien aus dem Repository und schreibt Änderungen
// als einen Commit (Git Data API). Zugang über ein Token, das nur auf dem Server liegt.

const API = process.env.GITHUB_API_URL || "https://api.github.com";
const REPO = process.env.GITHUB_REPO || "mappinger/pt-kbg";
const BRANCH = process.env.GITHUB_BRANCH || "main";

async function gh(method, pfad, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN ist nicht konfiguriert.");
  const res = await fetch(`${API}/repos/${REPO}${pfad}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "physiotherapie-kaumberg-cms",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const fehler = new Error(`GitHub ${method} ${pfad}: ${res.status} ${await res.text()}`);
    fehler.status = res.status;
    throw fehler;
  }
  return res.status === 204 ? null : res.json();
}

// Dateibaum des Branches (Pfad → Blob-SHA), kurz zwischengespeichert,
// weil das CMS beim Öffnen viele Anfragen kurz hintereinander schickt.
let baum = null;
let baumZeit = 0;

export async function dateiBaum() {
  if (baum && Date.now() - baumZeit < 5000) return baum;
  const daten = await gh("GET", `/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`);
  baum = new Map(daten.tree.filter((e) => e.type === "blob").map((e) => [e.path, e.sha]));
  baumZeit = Date.now();
  return baum;
}

// Blobs ändern sich nie (Inhalt = SHA), daher dauerhaft zwischenspeichern
const blobs = new Map();

export async function blobLesen(sha) {
  if (blobs.has(sha)) return blobs.get(sha);
  const daten = await gh("GET", `/git/blobs/${sha}`);
  const inhalt = Buffer.from(daten.content, "base64");
  if (blobs.size > 500) blobs.clear();
  blobs.set(sha, inhalt);
  return inhalt;
}

/**
 * Schreibt mehrere Änderungen als einen Commit.
 * @param {{path: string, content?: Buffer, delete?: boolean}[]} aenderungen
 * @param {string} nachricht
 * @param {{name: string, email: string}} autor
 */
export async function committen(aenderungen, nachricht, autor) {
  const eintraege = await Promise.all(
    aenderungen.map(async (a) => {
      if (a.delete) return { path: a.path, mode: "100644", type: "blob", sha: null };
      const blob = await gh("POST", "/git/blobs", { content: a.content.toString("base64"), encoding: "base64" });
      return { path: a.path, mode: "100644", type: "blob", sha: blob.sha };
    })
  );

  // Falls gleichzeitig jemand anderer speichert, auf dem neuen Stand erneut versuchen
  for (let versuch = 1; ; versuch++) {
    const ref = await gh("GET", `/git/ref/heads/${encodeURIComponent(BRANCH)}`);
    const eltern = await gh("GET", `/git/commits/${ref.object.sha}`);
    const tree = await gh("POST", "/git/trees", { base_tree: eltern.tree.sha, tree: eintraege });
    const commit = await gh("POST", "/git/commits", {
      message: nachricht,
      tree: tree.sha,
      parents: [ref.object.sha],
      author: { ...autor, date: new Date().toISOString() },
    });
    try {
      await gh("PATCH", `/git/refs/heads/${encodeURIComponent(BRANCH)}`, { sha: commit.sha });
      baum = null;
      return commit.sha;
    } catch (err) {
      if (err.status !== 422 || versuch >= 3) throw err;
    }
  }
}
