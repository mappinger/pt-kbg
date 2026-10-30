// Serverseitiges Backend für Decap CMS (Proxy-Protokoll, wie `decap-server`),
// das Inhalte über die GitHub-API liest und speichert.
import path from "node:path";
import { dateiBaum, blobLesen, committen } from "./github.js";

// Lesen: alles unter src/. Schreiben: nur Inhalte – keine Templates, Skripte oder Workflows.
const LESBAR = /^src\/[^]+$/;
const SCHREIBBAR = [
  /^src\/[\w-]+\.md$/,
  /^src\/team\/[\w-]+\.md$/,
  /^src\/_data\/[\w-]+\.json$/,
  /^src\/images\/uploads\/[\w.-]+\.(jpe?g|png|webp|gif|svg|pdf)$/i,
];

function pruefen(p, schreiben = false) {
  const norm = path.posix.normalize(String(p || "")).replace(/^\/+/, "");
  const erlaubt = schreiben ? SCHREIBBAR.some((r) => r.test(norm)) : LESBAR.test(norm);
  if (norm.includes("..") || !erlaubt) {
    const err = new Error(`Zugriff auf „${p}“ ist nicht erlaubt.`);
    err.status = 403;
    throw err;
  }
  return norm;
}

async function eintrag(p, label) {
  const sha = (await dateiBaum()).get(p);
  if (!sha) return { data: null, file: { path: p, label, id: null } };
  return { data: (await blobLesen(sha)).toString("utf8"), file: { path: p, label, id: sha } };
}

async function mediendatei(p) {
  const sha = (await dateiBaum()).get(p);
  if (!sha) {
    const err = new Error(`Datei „${p}“ nicht gefunden.`);
    err.status = 404;
    throw err;
  }
  const inhalt = await blobLesen(sha);
  return { id: sha, content: inhalt.toString("base64"), encoding: "base64", path: p, name: path.posix.basename(p) };
}

function imOrdner(baum, ordner, endung = "", tiefe = 1) {
  const praefix = ordner.replace(/\/+$/, "") + "/";
  return [...baum.keys()].filter((p) => {
    if (!p.startsWith(praefix) || !p.endsWith(endung)) return false;
    return p.slice(praefix.length).split("/").length <= tiefe;
  });
}

export async function cmsAktion(action, params = {}, benutzer) {
  const autor = { name: benutzer.name || benutzer.email, email: benutzer.email };
  const nachricht = (fallback) => `${params.options?.commitMessage || fallback}\n\nÜber das CMS von ${autor.name} <${autor.email}>`;

  switch (action) {
    case "info":
      return { repo: "physiotherapie-kaumberg", publish_modes: ["simple"], type: "github_proxy" };

    case "entriesByFolder": {
      const ordner = pruefen(params.folder);
      const dateien = imOrdner(await dateiBaum(), ordner, params.extension || "", params.depth || 1);
      return Promise.all(dateien.map((p) => eintrag(p)));
    }

    case "entriesByFiles":
      return Promise.all((params.files || []).map((f) => eintrag(pruefen(f.path), f.label)));

    case "getEntry":
      return eintrag(pruefen(params.path));

    case "persistEntry": {
      const dataFiles = params.dataFiles || [params.entry];
      const baum = await dateiBaum();
      const aenderungen = [];
      for (const d of dataFiles) {
        const ziel = pruefen(d.newPath || d.path, true);
        aenderungen.push({ path: ziel, content: Buffer.from(d.raw, "utf8") });
        // Umbenennen (z. B. neuer Name eines Teammitglieds): alte Datei entfernen
        if (d.newPath && d.newPath !== d.path && baum.has(pruefen(d.path, true))) {
          aenderungen.push({ path: pruefen(d.path, true), delete: true });
        }
      }
      for (const a of params.assets || []) {
        aenderungen.push({ path: pruefen(a.path, true), content: Buffer.from(a.content, a.encoding) });
      }
      await committen(aenderungen, nachricht("Inhalt geändert"), autor);
      return { message: "entry persisted" };
    }

    case "getMedia": {
      const ordner = pruefen(params.mediaFolder);
      const dateien = imOrdner(await dateiBaum(), ordner).filter((p) => !p.endsWith(".gitkeep"));
      return Promise.all(dateien.map(mediendatei));
    }

    case "getMediaFile":
      return mediendatei(pruefen(params.path));

    case "persistMedia": {
      const a = params.asset;
      const ziel = pruefen(a.path, true);
      const inhalt = Buffer.from(a.content, a.encoding);
      const sha = await committen([{ path: ziel, content: inhalt }], nachricht(`Bild hochgeladen: ${ziel}`), autor);
      return { id: sha, content: a.content, encoding: a.encoding, path: ziel, name: path.posix.basename(ziel) };
    }

    case "deleteFile":
    case "deleteFiles": {
      const pfade = (params.paths || [params.path]).map((p) => pruefen(p, true));
      const baum = await dateiBaum();
      const vorhanden = pfade.filter((p) => baum.has(p));
      if (vorhanden.length) {
        await committen(vorhanden.map((p) => ({ path: p, delete: true })), nachricht(`Gelöscht: ${vorhanden.join(", ")}`), autor);
      }
      return { message: `deleted ${vorhanden.join(", ")}` };
    }

    case "getDeployPreview":
      return null;

    default: {
      const err = new Error(`Unbekannte Aktion ${action}`);
      err.status = 422;
      throw err;
    }
  }
}
