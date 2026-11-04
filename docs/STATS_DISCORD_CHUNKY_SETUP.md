# 5er Pasch: Stats, Discord, Chunky und Welt-Chronik

Stand: 4. November 2026. Paper 26.3 (Java 25+) laut bisheriger Konfiguration.
Die Live-Website wird erst durch das Merge dieses Pull Requests geändert.

## Was kommt von uns, was kommt als externes Plugin?

- **5erPaschPlayerSync 1.1.0 (eigenes Plugin):** bisherige Mitgliederliste, Online-Status, echte Minecraft-Statistiken und ausgewählte Chronik-Ereignisse. Kein zusätzlicher Netzwerk-Port nötig.
- **Website /stats.html:** Ranglisten für Spielzeit (Bukkit `PLAY_ONE_MINUTE` in **Ticks**; 72.000 Ticks ~ 1 Stunde), Mob-Kills, gelaufene Kilometer, Tode und Sprünge.
- **Website /index.html → Chronik:** verbindet eure manuell gepflegten Chronik-Einträge mit bestätigten neuen Beitritten und wichtigen Advancements.
- **DiscordSRV:** externes Plugin, verbindet Minecraft- und Discord-Chat.
- **Chunky:** externes Plugin, generiert Chunks vorab.

### 0. Vorher sichern

In PebbleHost > Files/Backups eine vollständige Sicherung anlegen, mindestens:
`world` / andere Welten, `plugins/` und `server.properties`.
Vor Änderungen ggf. die Welt-Namen aus `level-name` und Paper-Version aus der Konsole notieren.
Bevor Plugins installiert werden, prüfen, ob Java 25 für Paper 26.3 eingestellt ist.
Wenn keiner online ist, den Server geordnet über das Panel stoppen.

### 1. GitHub / Cloudflare

1. PR reviewen und mergen. Die Cloudflare-GitHub-Verbindung deployed den Produktions-Branch `main`.
2. **Die bestehenden Bindings bleiben unverändert:** Cloudflare Pages KV `PLAYER_DATA` und verschlüsseltes Secret `PLAYER_SYNC_TOKEN`. Nichts neu generieren, solange es bereits funktioniert.
3. Prüfen, ob `https://5erpasch.pages.dev/api/players` noch `"enabled":true` liefert. Das neue API gibt zusätzlich `stats`, `statsUpdatedAt` und `events` zurück.
4. Nach dem Plugin-Upgrade zeigt `/stats.html` die Ranglisten und `/index.html#chronik` neue Ereignisse.
5. **Alte Statistiken:** Der Server liest Vanilla-Werte aus den vorhandenen Spielerdateien; diese können historische Spielzeit/Tode enthalten. **Alte Chronik-Ereignisse werden nicht rückwirkend erfunden:** Die automatische Chronik beginnt mit dem Plugin-Upgrade.

### 2. Eigenes Paper-Plugin aktualisieren

1. Die neue JAR aus dem GitHub-Actions-Workflow **Build 5er Pasch player sync plugin** (Artifact `5erPaschPlayerSync`, ZIP entpacken, darin liegt die JAR) herunterladen.
2. In PebbleHost unter `plugins/` die **alte** `5erPaschPlayerSync.jar` entfernen und die neue gleichnamige JAR hochladen. **Nicht beide JARs gleichzeitig drin lassen!**
3. `plugins/5erPaschPlayerSync/config.yml` behalten und **unverändert** lassen, damit der geheime Token erhalten bleibt. Optional am Ende ergänzen:
   ```yaml
   chronicle-enabled: true
   heartbeat-seconds: 300
   ```
4. Paper neu starten, Konsole auf Fehler prüfen. Die neue API aktualisiert sich etwa alle 5 Minuten sowie nach Joins/Leaves/Advancements.
5. In der API müssen `statsUpdatedAt` und `stats` erscheinen. Beim Start können Spieler offline sein; die historischen Vanilla-Werte sind trotzdem auslesbar.
6. Der Button `Stats` im Website-Menü zeigt die Ranglisten, die Chronik steht auf der Startseite.

**Datenschutz:** Spielername und Minecraft-Statistiken sind über die Website öffentlich abrufbar. Informiert die Mitspieler. Die Daten enthalten keine Realnamen oder Serverzugangsdaten. Das Plugin sendet weder private Nachrichten noch Chatlogs. Einzelne Profile lassen sich bei Bedarf später aus öffentlichen Ranglisten ausschließen.

### 3. DiscordSRV einrichten

Offiziell: https://docs.discordsrv.com/installation/initial-setup/
Kompatibilität: https://modrinth.com/plugin/discordsrv

1. Offizielle **Bukkit/Paper-JAR** auswählen, deren Versionsseite **26.3** nennt. In PebbleHost nach `plugins/` hochladen, Server starten, damit `plugins/DiscordSRV/config.yml` erzeugt wird, danach stoppen.
2. Auf https://discord.com/developers/applications eine neue Anwendung mit Bot anlegen. Im Bot-Tab **MESSAGE CONTENT INTENT** und (wie von DiscordSRV beschrieben) **SERVER MEMBERS INTENT** aktivieren.
3. Bot mit minimalen Kanalrechten zum eigenen Discord-Server hinzufügen: Channel ansehen, Nachrichten lesen/senden, Verlauf lesen, Links einbetten. Keine Administratorrechte, sofern nicht nötig.
4. In Discord **Entwicklermodus** aktivieren; Rechtsklick auf Zielkanal → **ID kopieren**.
5. In `plugins/DiscordSRV/config.yml` die vorhandenen Einträge anpassen (keinen zweiten Eintrag derselben Art hinzufügen):
   ```yaml
   BotToken: "DEIN_GEHEIMER_DISCORD_BOT_TOKEN"
   Channels: {"global": "DEINE_DISCORD_KANAL_ID"}
   DiscordConsoleChannelId: ""
   ```
6. Datei speichern; Server neu starten und **Chat in beide Richtungen** testen. Bei fehlenden Nachrichten die Channelrechte und Intents prüfen.
7. **Wichtig:** Bot-Token niemals auf GitHub/in die Website stellen. Den Discord-Konsolenkanal absichtlich leer lassen: sonst wäre eine unnötige Remote-Konsole/zusätzliche Angriffsfläche möglich.

Eure Website hat bereits einen Discord-Link aus `public/config.js`; dort muss kein Bot-Token hinein.

### 4. Chunky einrichten

Offiziell: https://modrinth.com/plugin/chunky
Die Plugin-Seite listet **26.3** und Paper.

1. Passende Paper/Spigot-JAR herunterladen, in PebbleHost `plugins/` hochladen und Server neu starten. In der Konsole ggf. `plugins` ausführen und `Chunky` prüfen.
2. Ein **Backup vor der Chunk-Generierung** ist sehr wichtig. Prüfen, wie eure Hauptwelt tatsächlich heißt (`level-name`, Standard ist `world`).
3. In der PebbleHost-Konsole Befehle **ohne Slash** eingeben (in Minecraft mit Slash):
   ```text
   chunky world world
   chunky spawn
   chunky shape circle
   chunky radius 1000
   chunky selection
   chunky start
   ```
   `world` ggf. durch den **tatsächlichen Weltnamen** ersetzen. Radius 1000 meint Blöcke, nicht Chunks. Zunächst klein anfangen. `chunky spawn` wählt den Spawn; für eine entfernte Basis stattdessen `chunky center X Z`.
4. Mit `chunky progress` nachsehen; bei hohen Lasten oder neuen Spielern sofort `chunky pause` verwenden. Mit `chunky continue` fortsetzen.
5. **Nicht** `chunky trim` ausführen und nicht mehrere Welten gleichzeitig vor-generieren. Chunky kann CPU und Datenträger stark beanspruchen; auf die freie Speicherkapazität achten. Eine laufende BlueMap-Renderung und Chunky möglichst **nicht gleichzeitig** ausführen.
6. Chunky verbessert die Situation beim *erstmaligen Erkunden*, nicht automatisch Lag durch Redstone, Farmen oder zu viele Entities.

### 5. Testplan

- `/api/players` enthält `enabled:true` und ein neues `statsUpdatedAt` nach Plugin-Neustart.
- `/stats.html` zeigt echte Ranglisten; Werte werden aus dem Plugin geliefert.
- Ein **neuer** Spieler joint → erscheint in der Mitgliederliste; bei Erstbeitritt und eingeschalteter Chronik folgt ein Eintrag.
- Ein Spieler erreicht ein **neues** ausgewähltes Advancement → Website-Chronik zeigt Ereignis innerhalb der Synchronisierung.
- Discord-Chat wird in beide Richtungen übertragen, ohne dass der Bot Konsolenrechte hat.
- Chunky zeigt einen laufenden Fortschritt und kann sicher pausiert werden.

Bei Problemen: erst Paper-Konsole/Plugin-Fehler notieren, dann Cloudflare-API-Felder und Deployments prüfen. **Keine Secrets in Screenshots schicken.**
