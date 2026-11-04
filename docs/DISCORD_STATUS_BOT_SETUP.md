# 5er Pasch – Discord-Statusbot (Cloudflare Worker)

**Vorbereitet am 4. November 2026.** Dies ist ein **einseitig sendender Discord-Webhook-Bot**,
kein permanenter Gateway-Client mit Discord-Slash-Commands. Er benötigt weder
PebbleHost-RAM noch Discord-Bot-Token. Er wird dauerhaft über Cloudflare Worker
und Cron betrieben, auch wenn Minecraft heruntergefahren ist.

## Was der Bot macht

- Kontrolliert den Paper-Server `45.143.198.58:25605` alle **5 Minuten** über die
  öffentliche Minecraft-Status-API von [mcstatus.io](https://mcstatus.io/docs).
- Zeigt **🟢 ONLINE**, **🔴 OFFLINE**, **🟡 WARTUNG** oder **⚪ STATUS UNBEKANNT**.
- Schreibt in einen von euch bestimmten **Discord-Textkanal** mit einem eigenen Webhook.
- Erstellt **eine dauerhaft aktualisierte Embed-Statuskarte**. Die Karte wird bei
  jeder Prüfung **bearbeitet** statt alle fünf Minuten als neue Nachricht gesendet.
- Postet **zusätzlich eine neue Benachrichtigung**, wenn Status/Grund/ETA wechseln.
- Zeigt Spielerzahl, Serveradresse, tatsächliche Erreichbarkeit und Prüfzeitpunkt.
- Wartungsgrund, bekannter Offline-Grund und grobe Dauer können **vom iPhone
  aus** auf einer geschützten Verwaltungsseite eingestellt werden.
- Hat die externe Status-API selbst eine Störung, meldet er **UNBEKANNT** statt
  einen Minecraft-Ausfall zu erfinden.

**Wahrheit der Gründe:** Bei einem ungeplanten Serverabsturz kann ein
öffentlicher Ping nicht automatisch den tatsächlichen technischen Grund
ermitteln. Ohne von euch eingetragenen Grund erscheint daher ehrlich
`Ursache noch unbekannt`. Beim Wiederanlauf wird ein eingetragener
Offline-Grund automatisch gelöscht, damit spätere Ausfälle nicht falsch
begründet werden. Bei Wartung bleibt der Modus an, bis jemand ihn wieder auf
`Automatisch` stellt.

## Installation (ohne Live-Website zu verändern)

### Schritt 1 – Discord-Kanal und Webhook

1. In eurem Discord einen Textkanal erstellen, z. B. **#server-status**.
2. Kanal bearbeiten → **Integrationen** → **Webhooks** → **Neuer Webhook**.
3. Namen `5er Pasch · Status` setzen; gewünschtes Icon einstellen.
4. Den Webhook genau diesem Kanal zuordnen.
5. **Webhook-URL kopieren**, aber niemals in GitHub, den Chat, eine
   Bildschirmaufnahme oder die öffentliche Website einfügen.
6. In Discord braucht ihr Berechtigung **Webhooks verwalten**.

### Schritt 2 – Eigenen Cloudflare Worker erstellen

Wir verwenden bewusst einen **neuen Cloudflare Worker**, nicht eure bestehende
Cloudflare Pages Function `/api/players`. Eure Website und PlayerSync müssen
dafür **nicht** verändert werden.

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Worker**.
2. Worker beispielsweise `5erpasch-discord-status` nennen und erstellen.
3. Über **Edit code** den Inhalt von [worker.js](../discord-status-worker/worker.js)
   vollständig einfügen und deployen. Falls der Code-Editor auf dem iPhone
   schwierig ist, Safari → **Desktop-Website anfordern** oder einen PC verwenden.
4. Im Worker → **Bindings** → **Add binding** → **KV Namespace**:
   - Variable name: **`STATUS_STORE`** (genau so geschrieben).
   - Namespace: Ihr könnt **denselben KV-Namespace** auswählen, der bereits
     für `PLAYER_DATA` auf eurer Website verwendet wird. Der Bot nutzt
     eigene Schlüssel `5erpasch:discord-status:*`; Spielerlisten werden nicht verändert.
   - Falls ihr ihn nicht teilen wollt, alternativ einen neuen KV-Namespace anlegen.
5. Unter **Settings / Variables and Secrets** zwei **Secrets** anlegen:
   - **`DISCORD_WEBHOOK_URL`** = URL aus Discord, als verschlüsseltes Secret.
   - **`ADMIN_TOKEN`** = selbst erzeugter langer, zufälliger Schlüssel mit
     **mindestens 32 Zeichen**, ebenfalls Secret.
     Den Wert in deinem Passwortmanager speichern.
   - **Weder `PLAYER_SYNC_TOKEN` noch `DISCORD_BOT_TOKEN` sind hierfür nötig.**
6. Im Worker **Settings → Triggers / Cron Triggers** einen Zeitplan hinzufügen:
   ```text
   */5 * * * *
   ```
   Dies bedeutet **alle 5 Minuten**. Cloudflare führt den Worker unabhängig
   von eurem Minecraft-Server aus. Cron-Zeiten sind UTC.
7. Speichern/deployen. Cloudflare zeigt eine Worker-Adresse ähnlich
   `https://5erpasch-discord-status.<dein-subdomain>.workers.dev`.
   Diese Beispieladresse nicht wörtlich verwenden, sondern die tatsächlich
   im Dashboard angezeigte URL.

### Schritt 3 – Vom iPhone erste Meldung auslösen

1. Die eigene Worker-Adresse mit **`/admin`** am Ende öffnen.
2. `ADMIN_TOKEN` aus dem Passwortmanager in das Passwortfeld einfügen.
3. Betriebsmodus **Automatisch** auswählen.
4. **Jetzt prüfen** drücken. Der Bot erstellt sofort die erste Statuskarte
   in **#server-status**. Die normale Cron-Prüfung läuft danach automatisch.
5. Die erste Statuskarte in Discord **anpinnen**. Da die Nachricht bearbeitet
   wird, bleibt sie an derselben Stelle. Nur wenn jemand sie löscht, wird
   bei der nächsten Prüfung eine neue Nachricht erstellt.

### Schritt 4 – Wartungsmodus testen

1. Auf `/admin` Modus **Wartung** wählen.
2. Grund eingeben: `Wir erstellen ein Backup und aktualisieren Plugins.`.
3. Optional `bis 18 Uhr` eingeben, dann **Speichern und Discord aktualisieren**.
4. Im Discord-Kanal sollte die Karte **🟡 WARTUNG** mit dem korrekten
   Grund zeigen; zusätzlich gibt es eine neue Änderungsmitteilung.
5. **Nach Abschluss der Arbeiten** zurück auf **Automatisch** stellen.
6. Auch bei Wartung enthält die Karte die gemessene Erreichbarkeit, um
   einen online geschalteten Server nicht fälschlich als offline zu behaupten.

### Schritt 5 – Bekannten Offline-Grund eintragen

Im Modus **Automatisch** bei `Bekannter Offline-Grund` z. B.
`PebbleHost führt gerade eine geplante Migration durch.` eintragen.
Sobald ein Ping den Server als offline erkennt, zeigt der Bot diesen Grund.
Wenn ihr nichts eingetragen habt, wird **kein Grund erfunden**.
Beim erfolgreichen Wiederanlauf wird der alte Offline-Grund automatisch
entfernt. Wenn die externe Status-API nicht erreichbar ist, wird der Status
als **UNBEKANNT** gekennzeichnet.

## Hilfreiche Endpunkte

- `https://<EURE_WORKER_URL>/admin` – mobilfreundliche Verwaltung.
- `https://<EURE_WORKER_URL>/status` – öffentliche JSON-Statusausgabe.
- `POST /admin/status` – nur mit `Authorization: Bearer <ADMIN_TOKEN>`.
- `POST /admin/check` – sofortige Statusprüfung, ebenfalls geschützt.

Bei öffentlichem `GET /status` werden **keine Tokens** zurückgegeben.

## Problembehebung

| Problem | Lösung |
|---|---|
| `/status` meldet 503 | `STATUS_STORE`, `DISCORD_WEBHOOK_URL`, `ADMIN_TOKEN` und Bindings prüfen |
| Admin meldet 401 | Eingegebenen `ADMIN_TOKEN` kontrollieren |
| Admin meldet 502 | Worker-Logs prüfen; Webhook könnte gelöscht worden sein oder Token falsch sein |
| Discord zeigt `STATUS UNBEKANNT` | Externe mcstatus.io-Abfrage fehlgeschlagen; keine automatische Offline-Behauptung |
| Discord bleibt auf Wartung | Im Admin-Formular explizit auf **Automatisch** zurückstellen |
| In Discord erscheint kein Kanal | Webhook muss im richtigen Textkanal erstellt sein |
| Status ist verzögert | Es wird etwa alle 5 Minuten geprüft; Admin-Button `Jetzt prüfen` erzwingt Prüfung |
| Es entstehen doppelte Karten | Nach Löschung der alten Karte erstellt der Bot eine neue; diese erneut anpinnen |

## Technischer Hinweis / Grenzen

- Ein Discord **Webhook** ist ein Nachrichten-Sender, **kein interaktiver
  Discord-App-Bot**. Er kann ohne Discord-Bot-Token posten, aber keine
  Slash-Befehle wie `/wartung` in Discord empfangen. Der dafür vorgesehene,
  authentifizierte Weg ist das `/admin`-Formular. Eine Discord-App mit
  Slash-Commands könnte später ergänzt werden.
- Er liest keine PebbleHost-Konsole, besitzt keine Rechte auf der Minecraft-
  Welt und löst keine Serverneustarts aus.
- Discord-Webhook-URL und Admin-Schlüssel **nicht ins öffentliche Repo**
  kopieren. Im Worker nur als **verschlüsselte Cloudflare Secrets** eintragen.
- Statuswechsel sind abhängig vom Cloudflare-Zeitplan und der
  Drittanbieter-Status-API; geplante Checks sind nicht sekundengenau.
- Falls mehrere Cron-Aufrufe gleichzeitig laufen, können KV-Daten kurzfristig
  verzögert sichtbar sein. Für einen kleinen Freundes-SMP reicht die
  regelmäßige, best-effort-Synchronisierung normalerweise aus.

**Tests:** `node --test discord-status-worker/test.mjs`. Die Tests senden
weder echte Discord-Nachrichten noch greifen sie auf PebbleHost zu.
