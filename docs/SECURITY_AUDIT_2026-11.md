# 5er Pasch – Website Security Audit und schonender Live-Lasttest
Stand: 4. November 2026

## Prüfbereich
- Cloudflare Pages \`/\`, \`/stats.html\`, \`/map.html\` (statische Assets).
- Cloudflare Pages Functions \`/api/players\` (öffentlicher GET, token-geschützter POST).
- BlueMap HTTPS-Proxy \`/bluemap/*\` (Port 8189 des Paper-Servers).
- Separater Discord-Worker nur durch Code-Review; keine Änderungen am laufenden Worker.

## Behobene Probleme
1. **Browser-Sicherheitsheader** via \`public/_headers\`: restriktive Content
   Security Policy, Clickjacking-Schutz, MIME-Sniffing-Verbot, Referrer-Policy,
   Permissions-Policy und HSTS. Zulässige Domains sind speziell auf die
   vorhandenen Skin- und Status-Integrationen abgestimmt.
2. **Unbegrenzte Stream-Uploads** beim Minecraft-Sync-POST werden nun
   bereits beim Einlesen auf 100.000 Bytes begrenzt, auch ohne Content-Length.
   Der bestehende 32+-Zeichen-Bearer-Token und die Datenvalidierung bleiben.
3. **Amplification via öffentlicher API**: Cloudflare edge-cached öffentliche
   Spielerdaten für 15 Sekunden und ignoriert bei der Cache-Key-Bildung
   willkürliche URL-Query-Parameter. Bei nicht verfügbarem Cache fällt die
   Funktion auf den bisherigen KV-Leseweg zurück.
4. **BlueMap-Proxy**: Verweigert codierte Pfadtrenner, Kontrollezeichen,
   Backslashes, Dot-Segmente, überlange Pfade/Queries. Origin-Fetch ist
   mit 12 s begrenzt. Unveränderliche Kartenressourcen können 120 s an der
   Cloudflare-Edge gecacht werden (normale Cache-Misses funktionieren weiter).
   Lebende Einstellungen/JSON bleiben uncached. Sensible Upstream-Header wie
   Set-Cookie werden nicht an Besucher durchgereicht.

## Kontrollierter Live-Test über GitHub Actions
Die Umgebung von ChatGPT selbst erreicht \`5erpasch.pages.dev\` nicht:
DNS-/Web-Zugriff wird durch das lokale Werkzeug eingeschränkt. Als
**Workaround** führt ein GitHub-hosted Runner denselben Lasttest unter
\`.github/workflows/security-audit.yml\` tatsächlich gegen die echte Seite aus.

\`tests/live-site-check.mjs\`:
- 60 GET \`/\`, parallel maximal 4
- 35 GET \`/stats.html\`, parallel maximal 3
- 20 GET \`/map.html\`, parallel maximal 2
- 25 GET \`/api/players\`, parallel maximal 2
- plus eine Initialprobe, HTTP-Status- und Header-Audit, TTFB p50 / p95;
  Timeout 9 s; **Abbruch bei drei Serverfehlern/Timeouts**.

Gesamt 141 reine Lesezugriffe auf Cloudflare, kein POST, kein Login,
kein \`/bluemap/*\`-Tile-Stresstest, keine Anfragen direkt an
\`45.143.198.58:25605\` und keine unerwartete Minecraft-RAM-Belastung.
Für einen Hochlasttest von mehreren hundert Requests/s braucht es eine
separate, abgestimmte Staging-Umgebung mit Kapazitätsfreigabe des Hosters.

**Wichtig**: Die in diesem PR neu gesetzten Header sind erst nach Merge
und Cloudflare-Deployment live messbar. Der vor dem Merge laufende Test
prüft die alte Live-Seite und zeigt deren bisherigen Header-Status.
Die lokalen Security-Regressions werden dagegen direkt am PR-Code geprüft.

## Danach noch im Cloudflare-Dashboard prüfen
Nur dort lassen sich Regeln/Tarifkontingente tatsächlich aktivieren:
- **Security → WAF → Rate limiting**: \`POST /api/players\` auf seltene
  Sync-Aufrufe begrenzen, dabei die eigene feste PebbleHost-IP bzw. den
  authentifizierten Plugin-Traffic nicht unabsichtlich blockieren.
- **Rate limiting für \`/bluemap/*\`** nur nach Auswertung echter
  Zugriffslogs konfigurieren (Kartenkacheln senden parallel viele legitime
  GETs; pauschale Werte können BlueMap kaputtmachen).
- **Security → Bots**: Schutz gegen bekannte Bots prüfen, aber
  Minecraft-Statusabfragen und echte Besucher nicht challengen.
- KV-Bindings \`PLAYER_DATA\`, Secret \`PLAYER_SYNC_TOKEN\` und
  Discord-Worker-Secrets weiterhin ausschließlich in Cloudflare pflegen.
- **Cloudflare Web Analytics / Logs**: auffällige GET/POST-Spitzen,
  hohe Fehlerraten, übermäßige Cache-Misses bei BlueMap prüfen.

## Grenzen
- Ein kurzer 141-Request-Test misst kurzfristige Erreichbarkeit und
  Latenz des Cloudflare-Frontends; er garantiert keine Kapazität bei
  1.000 gleichzeitigen Besuchern.
- BlueMap basiert auf einem öffentlichen HTTP-Upstream, der bereits öffentlich
  erreichbar ist: Sichtbarkeit von Karten/Koordinaten ist eine
  zusätzliche Datenschutzentscheidung, keine Funktion der CSP.
- Die Tests benutzen ausschließlich öffentliche Endpunkte; keine
  Penetration gegen Gameserver, Discord oder geheime Admin-Endpunkte.
- Die CI-Prüfung legt keine realen Servergeheimnisse offen.
