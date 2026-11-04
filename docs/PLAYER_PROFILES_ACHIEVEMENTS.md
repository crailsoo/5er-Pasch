# Spielerprofile + Discord-Erfolgsmeldungen · 5er Pasch

Stand: 4. November 2026 · Vorbereitete Änderung, **nicht automatisch produktiv**.

## Überblick

Diese Erweiterung nutzt **ausschließlich bestehende Daten**:
- Die Paper-JAR `5erPaschPlayerSync 1.1.0` sendet bereits Spielerstatistiken und
  ausgewählte Minecraft-Fortschritte an `https://5erpasch.pages.dev/api/players`.
- Die vorhandenen Spieler-Karten öffnen schon ein Profil mit 3D-Skin, Rolle und Status.
- Unser existierender Cloudflare-Discord-Statusbot läuft unabhängig von Paper.
- Es wird **kein neues Paper-Plugin, kein Java-Dienst und kein Chunky benötigt**.
  Die zusätzliche RAM-Last auf dem Minecraft-Server ist damit praktisch null.

## 1. Profile auf der Website

Die Profil-Karten auf der Startseite zeigen nach dem Deployment:
- **Spielzeit**, **Tode**, **besiegte Mobs**, **zu Fuß zurückgelegte Kilometer** und **Sprünge**
  aus euren *echten* Vanilla-Paper-Statistiken;
- bis zu acht **seit Aktivierung der Welt-Chronik aufgezeichnete** Achievements;
- das Datum des jeweiligen Erfolgs und einen Hinweis auf den begrenzten Erfassungszeitraum;
- dieselben Inhalte auf Desktop und Mobile, ohne die bestehende Skin-/Statusanzeige zu ersetzen.

Das ist **keine Liste sämtlicher jemals freigeschalteter Vanilla-Advancements**.
Die existierende Paper-JAR protokolliert derzeit diese ausgewählten Fortschritte:
- Diamanten gefunden
- Das Nether betreten
- Netherfestung entdeckt
- Antiken Schrott gefunden
- Netherit-Rüstung hergestellt
- End-Gateway erkundet
- Der Enderdrache wurde besiegt
- Die Welt erkundet
- Ghast-Geschoss zurückgeschickt

Vor dem Plugin-Upgrade abgeschlossene Erfolge können nicht rückwirkend aus
`/api/players` rekonstruiert werden. Ohne Ereignisse steht ausdrücklich
„Noch keine seit Aktivierung der Chronik erfassten Achievements“.

Bei API-Fehlern werden keine erfundenen „0“ oder Erfolgsabzeichen angezeigt.

## 2. Discord-Erfolgskanal

### Neue Discord-Einstellung

1. In eurem Discord einen eigenen Kanal **#erfolge** erstellen.
2. Kanal bearbeiten → Integrationen → Webhooks → Neuen Webhook erstellen,
   beispielsweise `5er Pasch · Erfolge`.
3. Die Webhook-URL **nicht** in GitHub, Chatnachrichten oder Screenshots kopieren.
4. Im Cloudflare Dashboard euren **bereits vorhandenen** Worker
   `5erpasch-discord-status` öffnen.
5. Unter **Settings → Variables and Secrets → Add variable** ein
   **verschlüsseltes Secret** anlegen:

   ```text
   ACHIEVEMENT_WEBHOOK_URL
   ```

   Wert: die frisch kopierte Discord-Webhook-URL für **#erfolge**.

**Nichts an `DISCORD_WEBHOOK_URL`, `ADMIN_TOKEN` und `STATUS_STORE`
ändern!** Das bleiben die Einstellungen eures funktionierenden Statusbots.

### Worker-Code vorbereiten und erst nach Review deployen

Die neuen Erfolgsmeldungen sind in
[`discord-status-worker/worker.js`](../discord-status-worker/worker.js)
enthalten. Im GitHub-Pull-Request findet ihr den vollständigen Diff.

**Achtung:** Ihr habt den Statusbot in der Vergangenheit *direkt im Cloudflare
Dashboard* konfiguriert und möglicherweise dort weiter verändert, etwa um
den früheren HTTP-503-Fehler zu beheben. GitHub kennt solche manuellen
Änderungen **nicht automatisch**.

Darum **nicht blind den gesamten Worker-Code aus dem Branch über eure
Live-Version kopieren**. Zuerst im Cloudflare-Editor den aktuell laufenden
Code sichern und mit dem GitHub-Diff vergleichen. Dann nur die neuen
Erfolgsmeldungs-Funktionen und den zusätzlichen Button integrieren;
bestehende 503-Fixes und Secrets beibehalten. Bei Bedarf diesen Schritt
mit ChatGPT Work im Cloud Browser durchführen.

Im Worker muss bereits ein Cron-Trigger laufen:

```text
*/5 * * * *
```

Für die Erfolgsmeldungen **keinen zweiten Cron-Trigger** anlegen.
Der vorhandene Worker prüft die öffentliche Ereignisliste im selben Takt.

### Erstmaliger Test (kein Spam)

1. Den Worker mit dem ergänzten Code deployen. Die Statuskarte im
   bisherigen Discord-Kanal muss weiter funktionieren.
2. Auf der bestehenden Worker-`/admin`-Seite findet ihr den neuen
   Button **„Erfolge prüfen“**. Mit `ADMIN_TOKEN` anmelden.
3. Bei der **ersten** Prüfung speichert der Bot vorhandene Achievements als
   Ausgangsstand und sendet **absichtlich noch keine Discord-Nachrichten**.
4. Danach muss ein Spieler einen der **oben aufgeführten, noch nicht
   erreichten** Fortschritte schaffen (z. B. ein erster Nether-Besuch).
5. Das Paper-Plugin überträgt ihn nach wenigen Sekunden bis Minuten via
   `/api/players`. Der Cloudflare Worker pollt alle fünf Minuten.
6. In **#erfolge** erscheint ein Discord-Embed mit Spielername, Erfolg,
   Datum und Link zur Welt-Chronik.
7. Weitere Cron-Prüfungen dürfen denselben Erfolg **nicht** erneut posten.

Mit dem Button **„Erfolge prüfen“** kann man die Discord-Prüfung
auch sofort auslösen. Er löst keine zusätzlichen Paper-Serverarbeiten aus.

### Fehler / Sicherheit

| Symptom | Ursache / Vorgehen |
| --- | --- |
| Statusbot läuft, aber #erfolge ist leer | `ACHIEVEMENT_WEBHOOK_URL` fehlt, Code wurde noch nicht ergänzt oder bisher kein **neuer** gelisteter Erfolg |
| „Erfolge prüfen“ ergibt 503 | `ACHIEVEMENT_WEBHOOK_URL` fehlt oder hat ein ungültiges Discord-Webhook-Format |
| „Erfolge prüfen“ ergibt 401 | Geheimer `ADMIN_TOKEN` stimmt nicht |
| „Erfolge prüfen“ ergibt 502 | API-/Discord-Fehler, in Cloudflare unter Observability → Logs nachsehen |
| Alte Erfolge fehlen | Die bisherige Chronik speichert nur ausgewählte neue Erfolge nach der Plugin-Aktivierung |
| Statusmeldungen funktionieren nicht mehr | Worker-Code mit vorheriger funktionierender Cloudflare-Version vergleichen/rollback |

**Kein zusätzlicher Discord-Bot-Token nötig.** Es wird lediglich ein
zweiter ausgehender Webhook im eigenen Kanal verwendet. Dieser enthält
keine Remote-Konsole. Mit `allowed_mentions: {parse: []}` werden keine
Erwähnungen ausgelöst.

### Technische Details

- Nur `type: advancement` aus dem vorhandenen öffentlichen
  Ereignis-API wird angekündigt; `join` wird ignoriert.
- Die Zuordnung zu einem Spieler erfolgt anhand des genauen bekannten
  Minecraft-Namens als Präfix des protokollierten Ereignisses.
- In Cloudflare-KV `STATUS_STORE` wird ein **eigener** Schlüssel für
  bereits versendete IDs benutzt (`5erpasch:discord-achievements:delivered:v1`).
  Spielerlisten und Statuskarte bleiben unangetastet.
- Maximal fünf Erfolgsmeldungen pro Prüfung. Bei Discord-Fehler wird
  der fehlgeschlagene Erfolg **nicht als gesendet markiert**.
- Gleichzeitige Cron-Aufrufe können wegen der eventuellen Konsistenz von
  KV im Grenzfall zu doppelten Nachrichten führen; für garantiertes
  Exactly-Once-Verhalten wäre ein Durable Object sinnvoll.
- Discord-Ereignisse erscheinen nur, wenn die Website-API und Discord
  erreichbar sind. Der Statusbot arbeitet bei einem fehlenden optionalen
  Erfolgskanal ganz normal weiter.

## GitHub-Abhängigkeit

Der bisherige Cloudflare-Statusbot liegt weiterhin in
[Pull Request #3](https://github.com/crailsoo/5er-Pasch/pull/3),
während der Worker bereits über das Cloudflare-Dashboard
manuell produktiv betrieben wird.

Der neue Pull Request baut **technisch auf Branch #3** auf, damit der
Discord-Worker-Code nicht dupliziert wird. Am einfachsten erst PR #3
reviewen/mergen, danach diesen PR und erst anschließend die Live-Änderungen
im Cloudflare-Dashboard deployen.

## Tests

Der GitHub-CI-Testlauf führt die bisherige Statusbot-Testreihe, neue
Achievement-Webhook-Tests und einen Test zur Zuordnung der Profil-Daten
aus. Es werden keine echten Discord-Nachrichten versendet.
