// GitHub-OAuth für Decap CMS: /api/auth leitet zu GitHub weiter,
// /api/callback tauscht den Code gegen ein Token und gibt es an das CMS-Fenster zurück.
import crypto from "node:crypto";

const GITHUB = "https://github.com/login/oauth";

const html = (body, status = 200) => ({
  status,
  headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  body,
});

// Übergibt das Ergebnis per postMessage an /admin (Protokoll von Decap CMS)
const antwort = (status, inhalt) => {
  const nachricht = `authorization:github:${status}:${JSON.stringify(inhalt)}`;
  return html(`<!doctype html><meta charset="utf-8"><title>Anmeldung</title><body><script>
  (function () {
    var nachricht = ${JSON.stringify(nachricht)};
    window.addEventListener("message", function (e) {
      if (e.origin !== window.location.origin) return;
      window.opener.postMessage(nachricht, e.origin);
      setTimeout(function () { window.close(); }, 200);
    }, false);
    window.opener.postMessage("authorizing:github", window.location.origin);
  })();
  </script>Anmeldung wird abgeschlossen …</body>`);
};

export function auth(url) {
  const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) return html("OAUTH_GITHUB_CLIENT_ID ist nicht konfiguriert.", 500);

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/callback`,
    scope: url.searchParams.get("scope") || "repo,user",
    state,
  });
  return {
    status: 302,
    headers: {
      Location: `${GITHUB}/authorize?${params}`,
      "Set-Cookie": `cms_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
    body: "",
  };
}

export async function callback(url, cookieHeader = "") {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = cookieHeader.match(/(?:^|;\s*)cms_oauth_state=([a-f0-9]+)/);

  if (!code || !state || !cookie || cookie[1] !== state) {
    return antwort("error", { message: "Ungültige Anmeldung – bitte erneut versuchen." });
  }

  try {
    const res = await fetch(`${GITHUB}/access_token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.OAUTH_GITHUB_CLIENT_ID,
        client_secret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const daten = await res.json();
    if (!daten.access_token) {
      console.warn("GitHub-OAuth fehlgeschlagen:", daten.error);
      return antwort("error", { message: daten.error_description || "Anmeldung fehlgeschlagen." });
    }
    return antwort("success", { token: daten.access_token, provider: "github" });
  } catch (err) {
    console.error(err);
    return antwort("error", { message: "GitHub ist nicht erreichbar." });
  }
}
