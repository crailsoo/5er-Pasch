# 5er Pasch – Minecraft SMP

Die Website für unseren Minecraft-Server mit Bauprojekten, Weltfortschritt, Spielerprofilen, Neuigkeiten, Live-Serverstatus und optionaler BlueMap-Weltkarte.

## Cloudflare Pages

Das Repository ist direkt für Cloudflare Pages vorbereitet.

| Einstellung | Wert |
| --- | --- |
| Repository | `crailsoo/5er-Pasch` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `exit 0` (alternativ leer) |
| Build output directory | `public` |
| Root directory | Repository-Stammverzeichnis (leer lassen) |

Über Cloudflare Dashboard → **Workers & Pages → Create application → Pages → Import an existing Git repository** verbinden. Cloudflare veröffentlicht neue Commits auf `main` automatisch.

## Dateien

- `public/index.html` – Inhalt und Seitenstruktur
- `public/style.css` – Farben, Rundungen, Layout und Responsive Design
- `public/app.js` – Anzeige von Projekten, Spieler-Skins, Fortschritt und Serverstatus
- `public/config.js` – eure Inhalte, Minecraft-Serveradresse und BlueMap-URL
- `public/assets/` – Grafiken und eigene Screenshots

## Eigene Inhalte eintragen

In `public/config.js` die `serverAddress` (gegebenenfalls mit Port), `edition`, `bluemapUrl`, `players`, `projects`, `milestones` und `updates` anpassen. Bis dahin zeigt die Website Beispieldaten.

Für Projekt-Screenshots Bilder unter `public/assets/` hochladen und im jeweiligen Projekt `image: "assets/dein-bild.webp"` setzen.

Das Hero-Bild ist zunächst eine Minecraft-inspirierte SVG-Illustration. Später kann es durch einen echten Screenshot ersetzt werden; dann die Datei im HTML bei `class="hero-image"` ändern.

Die Serverstatus-Abfrage verwendet `mcstatus.io`, Spieler-Avatare optional `mc-heads.net`. Eine interaktive BlueMap muss separat am Minecraft-Server mit einer öffentlich erreichbaren HTTPS-Adresse eingerichtet werden.

**Sicherheit:** Keine Zugangsdaten, privaten Schlüssel oder RCON-Passwörter in `config.js` speichern; alle Dateien im `public`-Ordner sind öffentlich.

Weitere Infos: https://developers.cloudflare.com/pages/get-started/git-integration/
