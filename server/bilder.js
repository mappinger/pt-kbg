// Bildbearbeitung beim Hochladen über das CMS: Handyfotos richtig drehen, auf eine
// sinnvolle Größe verkleinern und Metadaten (z. B. GPS-Standort) entfernen.
// Für die Medienbibliothek werden kleine Vorschaubilder statt der Originale geliefert.

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("sharp nicht verfügbar – Bilder werden unverändert gespeichert.");
}

const MAX_KANTE = 2400;
const VORSCHAU_KANTE = 480;
const BEARBEITBAR = /\.(jpe?g|png|webp)$/i;

/** Verkleinert ein hochgeladenes Bild. Gibt bei Problemen das Original zurück. */
export async function optimieren(pfad, inhalt) {
  if (!sharp || !BEARBEITBAR.test(pfad)) return inhalt;
  try {
    const bild = sharp(inhalt, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_KANTE, height: MAX_KANTE, fit: "inside", withoutEnlargement: true });
    const typ = pfad.toLowerCase().split(".").pop();
    const ergebnis = await (typ === "png"
      ? bild.png({ compressionLevel: 9 })
      : typ === "webp"
        ? bild.webp({ quality: 82 })
        : bild.jpeg({ quality: 82, mozjpeg: true })
    ).toBuffer();
    // Nur übernehmen, wenn es tatsächlich kleiner wird
    return ergebnis.length < inhalt.length ? ergebnis : inhalt;
  } catch (err) {
    console.warn(`Bild ${pfad} konnte nicht optimiert werden:`, err.message);
    return inhalt;
  }
}

const vorschauCache = new Map();

/** Kleines Vorschaubild für die Medienbibliothek (zwischengespeichert nach Inhalt). */
export async function vorschau(sha, pfad, inhalt) {
  if (!sharp || !BEARBEITBAR.test(pfad)) return inhalt;
  if (vorschauCache.has(sha)) return vorschauCache.get(sha);
  try {
    const klein = await sharp(inhalt, { failOn: "none" })
      .rotate()
      .resize({ width: VORSCHAU_KANTE, height: VORSCHAU_KANTE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    if (vorschauCache.size > 1000) vorschauCache.clear();
    vorschauCache.set(sha, klein);
    return klein;
  } catch {
    return inhalt;
  }
}
