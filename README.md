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

## Weltkarte einrichten (BlueMap)

Die Website enthält unter /map.html eine eigene Kartenansicht. **Sie zeigt erst dann
eine echte 3D-Karte eurer Welt, wenn BlueMap auf dem Gameserver läuft.**
Die Minecraft-IP 45.143.198.58:25605 alleine gibt keine Weltdaten an die Website.

1. Installiere eine zur Minecraft-Version passende [BlueMap-Version](https://github.com/BlueMap-Minecraft/BlueMap/releases).
   Paper/Spigot: Datei in plugins/, Fabric/Forge: Datei in mods/.
2. Server einmal starten und im BlueMap-Konfigurationsordner in core.conf
   die Option accept-download: true bestätigen, dann neu starten.
3. Im Gameserver-Panel einen **zusätzlichen freien Port** freischalten lassen.
   In plugins/BlueMap/webserver.conf (oder dem entsprechenden Mod-Konfigurationspfad)
   enabled: true sicherstellen und port: auf den tatsächlich freigeschalteten
   Zusatzport setzen. Nicht den Minecraft-Port 25605 dafür verwenden.
4. Die BlueMap-Renderung abwarten und die Karte zunächst direkt unter
   http://SERVER-IP:ZUSATZPORT/ testen. Falls die Karte öffentlich sein soll,
   ggf. Zugang/Schutz/Koordinatenfreigabe bedenken.
5. Für **Einbettung** auf der Cloudflare-HTTPS-Website eine über HTTPS erreichbare
   BlueMap-URL konfigurieren, z. B. über einen geeigneten Reverse Proxy bzw.
   eine vom Hoster bereitgestellte HTTPS-Kartenadresse. Den tatsächlichen Link
   in public/config.js als bluemapUrl eintragen.
   HTTP-Karten können aus Sicherheitsgründen nicht in die HTTPS-Seite eingebettet
   werden; die Website bietet dann lediglich einen Link zum separaten Öffnen an.

Offizielle Anleitung:
https://github.com/BlueMap-Minecraft/BlueMapWiki/blob/master/wiki/getting-started/Installation.md

## Stats-Seite

/stats.html ist nur über das Dropdown-Menü der Website verlinkt (nicht direkt
als Link auf der Startseite). Die Statistiken kommen aus der öffentlichen
Minecraft-Status-API und werden etwa alle 60 Sekunden aktualisiert:

- Aktuell online, freie Slots und maximale Plätze
- Minecraft-Version, bei Freigabe die Server-Software und MOTD
- Vom Server freigegebene Spielernamen (oft nur eine Stichprobe)
- Spielerzahl-Verlauf **nur seit Öffnen der Stats-Seite**; keine dauerhafte Speicherung

Langfristige Statistiken wie Spielzeit, Tode, zurückgelegte Distanz oder abgebaute
Blöcke sind über die Status-Abfrage nicht verfügbar. Dafür wäre ein separates
Server-Plugin mit Statistik-API nötig.

API-Dokumentation: https://mcstatus.io/docs

## Eingebettete HTTPS-BlueMap (Cloudflare Pages Function)

Die Karte auf /map.html wird nun über eine eigene Pages Function eingebettet.
Die Dateien liegen in /functions/bluemap/[[path]].js, bei Aufrufen der Website
erscheint der Live-Renderer unter https://5erpasch.pages.dev/bluemap/index.html.
Die Cloudflare-Pages-Datei public/_routes.json begrenzt Functions-Aufrufe auf
/bluemap/*, damit alle anderen Website-Assets statisch bleiben.

Technischer Hintergrund: BlueMap läuft auf http://45.143.198.58:8189/.
Cloudflare Workers können nicht direkt IP-Adressen mit fetch abrufen.
Deshalb verwendet der fest konfigurierte Proxy den DNS-Alias
45-143-198-58.sslip.io, der auf die Server-IP auflöst. Dieser externe
DNS-Dienst kann später durch einen eigenen DNS-only A-Eintrag ersetzt werden.
Der Proxy holt ausschließlich Inhalte von diesem Server, kein freier URL-Proxy.

**Hinweis:** Diese Verbindung hängt vom Minecraft-Server, der DNS-Auflösung
und Cloudflare Pages Functions ab und muss nach dem Deployment im echten
Browser geprüft werden. Bei Verbindungsproblemen zeigt die Kartenansicht
weiterhin den direkten BlueMap-Link. Karten-Tiles erzeugen bei Nutzung viele
Functions-Aufrufe (Cloudflare-Free-Tarif-Limit beachten).

Cloudflare-Kompatibilitätsdatum 2024-09-02 oder neuer verwenden, damit
ausgehende Fetch-Anfragen auf Port 8189 nicht auf Port 80 umgeleitet werden.
Gegebenenfalls in Cloudflare Pages > Settings > Functions > Compatibility Date
für Production und Preview entsprechend einstellen.

## Spielerprofile und Welt-Chronik

Die Charaktere auf der Startseite lassen sich anklicken. Im Profil erscheinen Skin, Name, Rolle und Live-Status. Optional lassen sich in public/config.js pro Spieler joined, base und description eintragen. Unbekannte Angaben werden nicht erfunden. Die Welt-Chronik wird aus SITE_CONFIG.chronicle mit date (YYYY-MM-DD), title und description befüllt. Als erstes bestätigtes Ereignis ist der BlueMap-Start am 3. November 2026 enthalten.

## Automatische Spieler-Synchronisierung

Ein eigenes Paper-Plugin sendet bekannte Spieler und ihren Online-Status an eine
Cloudflare Pages Function mit KV-Speicher. Der sichere POST-Endpunkt wird erst
nach Einrichtung von `PLAYER_DATA` und `PLAYER_SYNC_TOKEN` aktiviert.
Die bestehende Mitgliederliste bleibt bis dahin sichtbar.

**Einrichtungsanleitung:** [docs/PLAYER_SYNC_SETUP.md](docs/PLAYER_SYNC_SETUP.md)

**Plugin-Quellcode:** [server-plugin/](server-plugin/). Der GitHub-Actions-Workflow
`Build 5er Pasch player sync plugin` erstellt eine installierbare JAR.
