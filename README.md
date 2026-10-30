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
npm start            # http://localhost:8080
```

CMS lokal testen (ohne Login, schreibt direkt in die Dateien):

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
| `src/images/uploads/` | Über das CMS hochgeladene Bilder |

## Veröffentlichen (Netlify, kostenlos)

1. Auf [netlify.com](https://app.netlify.com) „Add new site → Import from Git“ → dieses Repository wählen. Build-Einstellungen kommen aus `netlify.toml`.
2. **Login für das CMS:** In Netlify unter *Site configuration → Access & security → OAuth* einen GitHub-Provider anlegen
   (dazu auf GitHub unter *Settings → Developer settings → OAuth Apps* eine App mit Callback-URL `https://api.netlify.com/auth/done` erstellen und Client-ID/Secret eintragen).
3. Die Praxis-Mitarbeiter:innen brauchen einen (kostenlosen) GitHub-Account und werden im Repository als *Collaborator* (Schreibrechte) eingeladen.
4. Domain: In Netlify *Domain management* → `www.physiotherapie-kaumberg.at` hinzufügen und beim Domain-Anbieter die DNS-Einträge wie angezeigt umstellen. HTTPS wird automatisch eingerichtet.

Jede Änderung im CMS erzeugt einen Commit auf `main`; Netlify baut die Seite danach automatisch neu (ca. 1 Minute).

## Vor dem Livegang noch offen

- [ ] **Impressum** und **Datenschutzerklärung** prüfen (Platzhalter in `[eckigen Klammern]`) – die alte Seite hatte beides nicht.
- [ ] **Logo als Vektordatei** (SVG/PDF/AI) besorgen – derzeit nur das alte 200×71-px-JPG vorhanden, wirkt auf hochauflösenden Displays leicht unscharf.
- [ ] Marina: „Osteopathin“ (Profilseite) vs. „Osteopathin i.A.“ (alte Kontaktseite) – übernommen wurde „Osteopathin“ (Diplomstudium 2015–2022 abgeschlossen).
- [ ] Optional: Öffnungs-/Telefonzeiten ergänzen.
