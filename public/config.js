/*
  5ER PASCH – EINSTELLUNGEN
  Diese Datei könnt ihr direkt auf GitHub bearbeiten.
  Leere serverAddress = kein Live-Status. Leere bluemapUrl = keine Kartenverlinkung.
  Alle untenstehenden Projekte, Meilensteine und Updates sind DEMODATEN.
*/
window.SITE_CONFIG = {
  serverName: "5er Pasch",
  description: "Eine kleine Minecraft-Welt mit großen Ideen. Hier sammeln wir unsere Bauprojekte, Weltfortschritte und alles, was unseren Server nach und nach besonders macht.",
  welcomeText: "5er Pasch ist unser gemeinsamer Minecraft-Server. Hier siehst du, woran wir gerade bauen, welche Meilensteine wir erreicht haben und wie sich unsere Welt entwickelt.",
  discordUrl: "https://discord.gg/drFRpdAc7q",
  discordLabel: "Discord öffnen",
  serverAddress: "45.143.198.58:25605", // Öffentliche Minecraft-Java-Adresse
  bedrockAddress: "", // optional, falls ihr eine separate Bedrock-Adresse anzeigen wollt
  edition: "java", // "java" oder "bedrock" für die Statusabfrage
  bluemapUrl: "http://45.143.198.58:8189/#world:-217:0:-4894:2989:-0.05:0:0:0:perspective", // BlueMap ist live; für HTTPS-Einbettung später HTTPS-Link verwenden
  // Alle Servermitglieder für die Website eintragen, zum Beispiel:
  // { name: "Anzeigename", username: "MinecraftUsername", role: "Spieler" }
  // "username" ist der echte Java-Minecraft-Name für das Skin-Bild.
  // Die Live-Liste unter "Gerade online" wird separat aus dem Serverstatus geladen.
  // Bekannte Ereignisse unserer Welt; neue Einträge mit date (JJJJ-MM-TT), title und description.
  chronicle: [
    { date: "2026-11-03", title: "Unsere Welt bekommt eine Karte", description: "BlueMap wird auf dem Paper-Server eingerichtet und der Render unserer Welt beginnt." }
  ],
  // Optionale Spielerprofil-Felder: joined, base, description. Ohne Werte werden sie ausgeblendet.
  players: [
    { name: "sams939", username: "sams939", role: "Server Owner" },
    { name: "SALTYPIMP", username: "SALTYPIMP", role: "Spieler" },
    { name: "Ben_Keynoobie", username: "Ben_Keynoobie", role: "Spieler" }
  ],
  projects: [
    { title: "Die Bergfestung", category: "MEGABASE", status: "bau", progress: 72, builders: ["Spieler 01", "Spieler 02"], description: "Eine Festung direkt im Gebirge, mit mächtigen Mauern, geheimen Gängen und einer Aussicht über das ganze Tal.", image: "", theme: "mountain", demo: true },
    { title: "Dorf am Fluss", category: "DORF", status: "bau", progress: 38, builders: ["Spieler 03", "Spieler 04"], description: "Aus einem kleinen Handelsposten entsteht ein lebendiges Dorf mit Brücken, Feldern und gemütlichen Häusern.", image: "", theme: "village", demo: true },
    { title: "Nether-Hub", category: "INFRASTRUKTUR", status: "fertig", progress: 100, builders: ["Spieler 05"], description: "Unser Verkehrsknotenpunkt im Nether. Von hier aus erreichen wir alle wichtigen Orte der Welt.", image: "", theme: "nether", demo: true }
  ],
  milestones: [
    { title: "Die erste Nacht", description: "Unser Überleben beginnt", done: true },
    { title: "Das Nether betreten", description: "Ein neues Kapitel öffnet sich", done: true },
    { title: "Den Enderdrachen besiegen", description: "Das Ende ist erst der Anfang", done: false },
    { title: "Unser erstes Großprojekt", description: "Gemeinsam etwas Bleibendes erschaffen", done: false },
    { title: "Alle Biome erkunden", description: "Einmal quer durch die ganze Welt", done: false }
  ],
  updates: [
    { date: "BEISPIEL", type: "BAUPROJEKT", title: "Ein neues Großprojekt entsteht", text: "Hier könnt ihr künftig Neuigkeiten und Fortschritte eurer Welt eintragen.", demo: true },
    { date: "BEISPIEL", type: "WELT", title: "Unsere Reise geht weiter", text: "Neue Entdeckungen und gemeinsame Erlebnisse finden hier ihren Platz.", demo: true }
  ]
};
