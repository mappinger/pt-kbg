// Anmeldung für das CMS über die in Azure App Service eingebaute Authentifizierung
// („Easy Auth“) mit Microsoft- oder Google-Konto. Zugelassen sind nur E-Mail-Adressen aus CMS_EDITORS.

const ANBIETER = {
  aad: { name: "Microsoft", login: "/.auth/login/aad" },
  google: { name: "Google", login: "/.auth/login/google" },
};

const EMAIL_CLAIMS = [
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "email",
  "emails",
  "preferred_username",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
];
const NAME_CLAIMS = ["name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];

const aufAzure = () => Boolean(process.env.WEBSITE_SITE_NAME);
// Nur wenn Easy Auth aktiv ist, entfernt Azure gefälschte x-ms-client-principal-Header von außen.
const easyAuthAktiv = () => String(process.env.WEBSITE_AUTH_ENABLED).toLowerCase() === "true";

export const anbieter = () =>
  (process.env.CMS_LOGIN_PROVIDERS || "aad,google")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ANBIETER[s])
    .map((id) => ({ id, ...ANBIETER[id] }));

const erlaubteAdressen = () =>
  (process.env.CMS_EDITORS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** @returns {null | {email: string, name: string, erlaubt: boolean}} */
export function benutzer(req) {
  let email = "";
  let name = "";

  if (easyAuthAktiv()) {
    const kodiert = req.headers["x-ms-client-principal"];
    if (!kodiert) return null;
    try {
      const principal = JSON.parse(Buffer.from(kodiert, "base64").toString("utf8"));
      const claim = (typen) => principal.claims?.find((c) => typen.includes(c.typ))?.val || "";
      email = claim(EMAIL_CLAIMS);
      name = claim(NAME_CLAIMS);
    } catch {
      return null;
    }
    email ||= String(req.headers["x-ms-client-principal-name"] || "");
  } else if (!aufAzure() && process.env.CMS_DEV_USER) {
    // Nur lokal zum Testen
    email = process.env.CMS_DEV_USER;
    name = "Lokaler Test";
  } else {
    return null;
  }

  email = email.trim().toLowerCase();
  if (!email.includes("@")) return null;
  return { email, name: name || email, erlaubt: erlaubteAdressen().includes(email) };
}

const seite = (titel, inhalt) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${titel} – Physiotherapie Kaumberg</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  :root { --red:#a12e26; --red-dark:#7d2019; --gold:#f2b33d; --ink:#2a1f1c; --muted:#6b5c56; --line:#eaded3; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink);
    background: radial-gradient(circle at 85% 10%, rgb(242 179 61 / .35), transparent 40%), #fbf7f2; }
  main { width:100%; max-width:420px; background:#fff; border:1px solid var(--line); border-radius:24px;
    padding:36px 28px; box-shadow:0 20px 50px -25px rgb(0 0 0 / .35); text-align:center; }
  img { width:180px; height:auto; mix-blend-mode:multiply; margin-bottom:12px; }
  h1 { font-size:1.4rem; margin:0 0 8px; }
  p { color:var(--muted); line-height:1.55; margin:0 0 24px; }
  a.btn { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; padding:14px 18px;
    margin-top:12px; border-radius:999px; border:2px solid var(--line); font-weight:600; font-size:1rem;
    color:var(--ink); text-decoration:none; background:#fff; }
  a.btn:hover { border-color:var(--red); color:var(--red); }
  a.btn--primary { background:var(--red); border-color:var(--red); color:#fff; }
  a.btn--primary:hover { background:var(--red-dark); color:#fff; }
  .klein { font-size:.9rem; margin:24px 0 0; }
  .klein a { color:var(--red); }
</style></head>
<body><main><img src="/images/logo.jpg" alt="Physiotherapie Kaumberg" width="200" height="71">${inhalt}</main></body></html>`;

const zurueck = encodeURIComponent("/admin/");

export function anmeldeSeite() {
  const knoepfe = anbieter()
    .map((a, i) => `<a class="btn${i === 0 ? " btn--primary" : ""}" href="${a.login}?post_login_redirect_uri=${zurueck}">Mit ${a.name}-Konto anmelden</a>`)
    .join("");
  const hinweis = easyAuthAktiv() || !aufAzure()
    ? ""
    : `<p class="klein"><strong>Hinweis für den Webbetreuer:</strong> Die Azure-Authentifizierung ist noch nicht aktiviert.</p>`;
  return seite("Anmelden", `<h1>Website bearbeiten</h1>
    <p>Bitte melden Sie sich mit Ihrem Microsoft- oder Google-Konto an.</p>${knoepfe}${hinweis}
    <p class="klein"><a href="/">← Zurück zur Website</a></p>`);
}

export function keinZugriffSeite(b) {
  const abmelden = `/.auth/logout?post_logout_redirect_uri=${zurueck}`;
  return seite("Kein Zugriff", `<h1>Kein Zugriff</h1>
    <p>Sie sind als <strong>${b.email.replace(/[<>&"]/g, "")}</strong> angemeldet. Diese Adresse ist nicht für die Bearbeitung der Website freigeschaltet.
    Bitte wenden Sie sich an Ihren Webbetreuer.</p>
    <a class="btn btn--primary" href="${abmelden}">Mit anderem Konto anmelden</a>
    <p class="klein"><a href="/">← Zurück zur Website</a></p>`);
}
