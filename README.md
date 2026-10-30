# Physiotherapie Kaumberg – Website

Neue Website für [physiotherapie-kaumberg.at](https://www.physiotherapie-kaumberg.at) (Ersatz für die WordPress-Seite von 2014).

- **[Eleventy](https://www.11ty.dev/)** erzeugt eine schnelle, statische Website (kein PHP, keine Datenbank, nichts zum Hacken).
- **[Decap CMS](https://decapcms.org/)** unter `/admin` – die Praxis bearbeitet Texte, Tarife, Team und Bilder selbst, ganz ohne Programmierkenntnisse (siehe [ANLEITUNG-CMS.md](ANLEITUNG-CMS.md)).
- Farben aus dem Logo (Weinrot `#A12E26`, Orange `#E07B39`, Goldgelb `#F2B33D`), Schriften *Outfit* & *Inter* lokal eingebunden.
- DSGVO-freundlich: keine Cookies, kein Tracking, keine Google Fonts / Google Maps.
- Bilder werden beim Build automatisch in AVIF/WebP und passende Größen umgerechnet – auch neu hochgeladene.
- Gleiche Adressen wie die alte Seite (`/die-praxis/`, `/behandlung/`, `/team/marina-soeroes/` …) → Google-Ranking bleibt erhalten.

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:8080 (mit Live-Reload)
```

CMS lokal testen (ohne Login, schreibt direkt in die lokalen Dateien):

```bash
npm run cms          # in einem zweiten Terminal, dann http://localhost:8080/admin/
```

## Struktur

| Pfad | Inhalt |
| --- | --- |
| `src/*.md` | Seiten – Inhalte stehen im Frontmatter und sind im CMS als Formular bearbeitbar |
| `src/team/*.md` | Ein File pro Teammitglied |
| `src/_data/site.json` | Kontaktdaten, E-Mail, Adresse |
| `src/_data/navigation.json` | Menü |
| `src/_includes/` | Layouts und Bausteine (Nunjucks) |
| `src/assets/css/main.css` | Gesamtes Design |
| `src/admin/config.yml` | CMS-Konfiguration (Felder, Beschriftungen) |
| `server/` | Webserver für Azure, CMS-Anmeldung und -Speicherung |
| `src/images/uploads/` | Alle Fotos der Website = Medienbibliothek im CMS |

## Hosting: Azure App Service (`ptkaumberg`)

Bei jedem Push auf `main` – also auch bei jeder Änderung im CMS – baut GitHub Actions die Seite
und veröffentlicht sie (`.github/workflows/main_ptkaumberg.yml`, Dauer ca. 3–4 Minuten).
Ausgeliefert wird nur ein schlankes Paket: die fertige Seite (`_site/`) und ein kleiner Node-Webserver
ohne Abhängigkeiten (`server/`).

Lokal wie auf Azure testen: `npm run build && npm start` → http://localhost:8080

### Wie das CMS speichert

```
Bearbeiter:in ──(Microsoft-/Google-Login, Azure)──▶ /admin  ──▶ /api/cms (server/cms-backend.js) ──(GITHUB_TOKEN)──▶ GitHub ──▶ Workflow ──▶ Azure
```

- Die Anmeldung übernimmt die **in Azure eingebaute Authentifizierung** (App Service „Authentifizierung“) mit Microsoft- oder Google-Konto.
  Zugelassen sind nur Adressen aus `CMS_EDITORS` (`server/anmeldung.js`). Niemand braucht ein GitHub-Konto.
- Gespeichert wird mit einem GitHub-Token, das nur in Azure liegt. Jede Änderung wird ein Commit mit der Person als Autor –
  in der Historie sieht man also, wer was geändert hat, und kann alles zurücknehmen.
- Hochgeladene Fotos werden am Server automatisch gedreht, auf max. 2400 px verkleinert und von Metadaten
  (GPS-Standort, Kameradaten) befreit (`server/bilder.js`). Dateinamen werden bereinigt („IMG Müller.JPG“ → `img-muller.jpg`).
  Die Medienbibliothek bekommt nur kleine Vorschaubilder, damit sie auch mit vielen Fotos schnell bleibt.
- Über das CMS dürfen nur Inhaltsdateien geändert werden (`src/*.md`, `src/team/*.md`, `src/_data/*.json`, `src/images/uploads/*`).
  Templates, Server-Code und Workflows sind gesperrt.

### Einrichtung (einmalig)

1. **App Service:** Linux, Runtime *Node 24 LTS*, kein Startbefehl nötig (`npm start`). „Nur HTTPS“ aktivieren.
2. **GitHub-Token:** GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*
   - Repository access: *Only select repositories* → `mappinger/pt-kbg`
   - Permissions → Repository permissions → **Contents: Read and write** (sonst nichts)
   - Ablaufdatum notieren und rechtzeitig erneuern (Kalendererinnerung!).
3. **Microsoft-Login:** App Service → *Authentifizierung* → *Identitätsanbieter hinzufügen* → **Microsoft**
   - App-Registrierung neu erstellen, unterstützte Kontotypen: **„Beliebiges Microsoft Entra-Verzeichnis und persönliche Microsoft-Konten“**
   - Zugriff einschränken: **„Nicht authentifizierten Zugriff zulassen“** (die Website selbst ist öffentlich, `/admin` schützt der Server)
   - Token-Speicher: aktiviert lassen
4. **Google-Login:** In der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) ein Projekt anlegen →
   *OAuth-Zustimmungsbildschirm* (Typ „Extern“, App-Name „Physiotherapie Kaumberg“, veröffentlichen) →
   *Anmeldedaten → OAuth-Client-ID* (Typ „Webanwendung“), autorisierte Weiterleitungs-URI:
   `https://<app-adresse>/.auth/login/google/callback`.
   Dann in Azure → *Authentifizierung* → *Identitätsanbieter hinzufügen* → **Google** mit Client-ID und Client-Secret.
5. **Umgebungsvariablen:** App Service → *Einstellungen → Umgebungsvariablen → App-Einstellungen*:

   | Name | Wert |
   | --- | --- |
   | `GITHUB_TOKEN` | das Token aus Schritt 2 |
   | `CMS_EDITORS` | erlaubte E-Mail-Adressen, mit Komma getrennt, z. B. `marina@gmail.com, praxis@outlook.at` |
   | `CMS_LOGIN_PROVIDERS` | optional, Standard `aad,google` (nur `aad` → nur Microsoft-Knopf) |

   Neue Bearbeiter:innen freischalten = Adresse bei `CMS_EDITORS` ergänzen und speichern. Mehr ist nicht nötig.
6. **Eigene Domain (Livegang):** App Service → *Benutzerdefinierte Domänen* → `www.physiotherapie-kaumberg.at`
   (erfordert mindestens Tarif *B1*). **Achtung:** MX-Einträge für die E-Mail nicht verändern.
   Danach bei Google die Weiterleitungs-URI für die neue Domain ergänzen (Microsoft wird von Azure automatisch angepasst).

## Vor dem Livegang noch offen

- [ ] **Impressum** und **Datenschutzerklärung** prüfen (Platzhalter in `[eckigen Klammern]`) – die alte Seite hatte beides nicht.
- [ ] **Logo als Vektordatei** (SVG/PDF/AI) besorgen – derzeit nur das alte 200×71-px-JPG vorhanden, wirkt auf hochauflösenden Displays leicht unscharf.
- [ ] Marina: „Osteopathin“ (Profilseite) vs. „Osteopathin i.A.“ (alte Kontaktseite) – übernommen wurde „Osteopathin“ (Diplomstudium 2015–2022 abgeschlossen).
- [ ] Optional: Öffnungs-/Telefonzeiten ergänzen.
