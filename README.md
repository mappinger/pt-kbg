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

## Hosting: Azure App Service (`ptkaumberg`)

Bei jedem Push auf `main` – also auch bei jeder Änderung im CMS – baut GitHub Actions die Seite
und veröffentlicht sie (`.github/workflows/main_ptkaumberg.yml`, Dauer ca. 3–4 Minuten).
Ausgeliefert wird nur ein schlankes Paket: die fertige Seite (`_site/`) und ein kleiner Node-Webserver
ohne Abhängigkeiten (`server/server.js`). Der Server stellt auch den CMS-Login bereit (`/api/auth`, `/api/callback`, siehe `server/cms-auth.js`).

Lokal wie auf Azure testen: `npm run build && npm start` → http://localhost:8080

### Einrichtung (einmalig)

1. **App Service:** Linux, Runtime *Node 24 LTS*. Kein Startbefehl nötig (es wird `npm start` ausgeführt).
   Unter *Einstellungen → Konfiguration* „Nur HTTPS“ aktivieren.
2. **GitHub-OAuth-App anlegen:** GitHub → *Settings → Developer settings → OAuth Apps → New OAuth App*
   - Homepage URL: `https://ptkaumberg.azurewebsites.net` (bzw. die Adresse aus der Azure-Übersicht)
   - Authorization callback URL: `https://<dieselbe Adresse>/api/callback`
   - Client-ID und ein neues Client-Secret notieren.
3. **Umgebungsvariablen:** App Service → *Einstellungen → Umgebungsvariablen → App-Einstellungen*:
   - `OAUTH_GITHUB_CLIENT_ID` = Client-ID
   - `OAUTH_GITHUB_CLIENT_SECRET` = Client-Secret
4. **Redakteur:innen:** Die Praxis-Mitarbeiter:innen brauchen einen (kostenlosen) GitHub-Account
   und werden im Repository unter *Settings → Collaborators* mit Schreibrechten eingeladen.
5. **Eigene Domain (Livegang):** App Service → *Benutzerdefinierte Domänen* → `www.physiotherapie-kaumberg.at`
   (erfordert mindestens Tarif *B1*, im Gratis-Tarif F1 nicht möglich). **Achtung:** MX-Einträge für die E-Mail nicht verändern.
   Danach die Callback-URL der OAuth-App auf die neue Domain ändern (eine OAuth-App hat nur eine Callback-URL –
   für Test- und Livesystem parallel zwei OAuth-Apps verwenden).

## Vor dem Livegang noch offen

- [ ] **Impressum** und **Datenschutzerklärung** prüfen (Platzhalter in `[eckigen Klammern]`) – die alte Seite hatte beides nicht.
- [ ] **Logo als Vektordatei** (SVG/PDF/AI) besorgen – derzeit nur das alte 200×71-px-JPG vorhanden, wirkt auf hochauflösenden Displays leicht unscharf.
- [ ] Marina: „Osteopathin“ (Profilseite) vs. „Osteopathin i.A.“ (alte Kontaktseite) – übernommen wurde „Osteopathin“ (Diplomstudium 2015–2022 abgeschlossen).
- [ ] Optional: Öffnungs-/Telefonzeiten ergänzen.
