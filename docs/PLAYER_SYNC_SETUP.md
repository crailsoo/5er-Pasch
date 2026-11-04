# 5er Pasch – automatische Spielersynchronisierung

Die Mitgliederseite lädt unter `/api/players` die Liste aller bekannten
Minecraft-Spieler. Ein kleines Paper-Plugin sendet beim Start, nach Joins/Leaves
und alle 5 Minuten einen vollständigen Snapshot an die Cloudflare Pages Function.
Das JavaScript aktualisiert die Anzeige im Browser ungefähr alle 60 Sekunden.

**Der Endpunkt ist zunächst deaktiviert.** Die bisher eingetragenen Spieler
in `public/config.js` bleiben sichtbar, bis Cloudflare und das Plugin eingerichtet sind.

## A. GitHub / Cloudflare Pages

1. Diesen Branch nach Prüfung mit `main` zusammenführen. Cloudflare Pages
   muss die Bereitstellung aus dem GitHub-Repository `crailsoo/5er-Pasch` verwenden.
2. Cloudflare Dashboard → **Storage & databases → KV** (oder **Workers KV**)
   → Namespace erstellen, z. B. `5erpasch-players`.
3. Cloudflare Dashboard → **Workers & Pages → dein Pages-Projekt →
   Settings → Bindings → Add → KV namespace**.
   **Variable name exakt `PLAYER_DATA`**, Namespace `5erpasch-players` auswählen.
4. **Settings → Variables and Secrets → Add**:
   - Name: `PLAYER_SYNC_TOKEN`
   - Wert: ein selbst generierter, zufälliger Schlüssel mit mind. 32 Zeichen
     (z. B. 64 Hex-Zeichen mit `openssl rand -hex 32`).
   - Als **Secret / Encrypt** speichern.
5. Binding und Secret für die **Production**-Umgebung konfigurieren
   und Cloudflare Pages **neu deployen**.
6. Im Browser `https://5erpasch.pages.dev/api/players` öffnen.
   Bei erfolgreicher Einrichtung kommt JSON mit `"enabled":true`;
   anfangs noch `"players":[]`. `"enabled":false` deutet auf fehlende
   Bindings bzw. fehlendes oder zu kurzes Secret hin.

**Wichtig:** Den Secret-Wert niemals im GitHub-Repository, im Browser,
in `public/config.js` oder in Chats veröffentlichen.

## B. PebbleHost / Paper

1. Die Datei `5erPaschPlayerSync-1.0.0.jar` in PebbleHost über
   **Files → plugins** hochladen (nicht entpacken).
2. Paper-Server starten. Das Plugin legt
   `plugins/5erPaschPlayerSync/config.yml` an.
3. In dieser Konfigurationsdatei den gleichen geheimen Wert
   unter `token` eintragen. Die `endpoint`-Adresse muss auf die
   **tatsächlich verwendete HTTPS-Website** zeigen und auf
   `/api/players` enden.
4. Paper-Server **neu starten** (nicht `/reload` verwenden).
5. Konsolenausgabe prüfen. Bei Fehlern:
   - HTTP 401: Secret in Plugin und Cloudflare stimmt nicht überein.
   - HTTP 503: Cloudflare Binding oder Secret fehlt, eventuell neu deployen.
   - HTTP 404: falsche Seitenadresse / Function nicht bereitgestellt.
   - `ConnectException` / `HttpConnectTimeoutException`: ausgehenden
     HTTPS-Zugriff oder DNS des Gamehosts prüfen.

## C. Prüfen

- `https://5erpasch.pages.dev/api/players` erneut im Browser öffnen:
  `"players"` sollte bekannte Namen enthalten, `"updatedAt"`
  einen Zeitstempel und `"fresh":true`.
- Website öffnen und in die Mitgliedersektion scrollen. Neue Spieler tauchen
  automatisch dort auf. Vorhandene Rollen/Beschreibungen aus `config.js`
  bleiben erhalten.
- Test mit einem Join und anschließendem Leave durchführen. Die Seite
  fragt alle 60 Sekunden neu ab.
- Nach einem Servercrash wird ein alter Online-Status nach 12 Minuten
  als nicht mehr aktuell betrachtet; die vorhandene Status-Abfrage kann
  solange gegebenenfalls noch Daten liefern.

## Technische Hinweise

- Cloudflare Pages: Function `functions/api/players.js`; Binding `PLAYER_DATA`;
  Secret `PLAYER_SYNC_TOKEN` und Function-Route in `public/_routes.json`.
- Es werden Minecraft-Namen, UUIDs (nicht im öffentlichen GET ausgegeben)
  und Online-Namen gespeichert. Der öffentliche Endpunkt hat **nur Leserechte**.
  Für Schreibzugriffe ist ein Bearer-Token nötig.
- Das Plugin führt keinerlei Minecraft-Befehle aus und braucht keinen RCON-
  Zugang und keine Zugangsdaten zum PebbleHost-Panel.
- Bekannte Spieler bleiben in der Cloudflare-Liste erhalten, auch wenn sie offline sind.
  Das Plugin nutzt `Bukkit.getOfflinePlayers()`, es kann daher Spieler
  aus bereits vorhandenen Serverdaten nachtragen.
- Der fünfminütige Heartbeat vermeidet unnötige Cloudflare-KV-Schreibzugriffe.
  Der Abgleich ist nicht auf die Sekunde genau; die KV-Daten können kurz verzögert sein.
- Das Plugin ist für die Java-21-Laufzeit kompiliert und nutzt nur die Bukkit-API.
  Die Funktion auf eurer tatsächlichen Paper-Version muss nach Installation geprüft werden.
