/*
  5ER PASCH – EINSTELLUNGEN
  Diese Datei könnt ihr direkt auf GitHub bearbeiten.
  Leere serverAddress = kein Live-Status. Leere bluemapUrl = Platzhalterkarte.
  Alle untenstehenden Projekte, Meilensteine und Updates sind DEMODATEN.
*/
window.SITE_CONFIG = {
  serverName: "5er Pasch",
  description: "Eine kleine Minecraft-Welt mit großen Ideen. Hier sammeln wir unsere Bauprojekte, Weltfortschritte und alles, was unseren Server nach und nach besonders macht.",
  welcomeText: "5er Pasch ist unser gemeinsamer Minecraft-Server. Hier siehst du, woran wir gerade bauen, welche Meilensteine wir erreicht haben und wie sich unsere Welt entwickelt.",
  discordUrl: "", // Hier euren echten Discord-Einladungslink eintragen
  discordLabel: "Discord öffnen",
  serverAddress: "", // z. B. "play.deinserver.de:25565" (öffentlich erreichbare Java-Adresse)
  bedrockAddress: "", // optional, falls ihr eine separate Bedrock-Adresse anzeigen wollt
  edition: "java", // "java" oder "bedrock" für die Statusabfrage
  bluemapUrl: "", // z. B. "https://map.deinedomain.de" – HTTPS für Einbettung erforderlich
  players: [
    { name: "Spieler 01", username: "", role: "Baumeister" },
    { name: "Spieler 02", username: "", role: "Entdecker" },
    { name: "Spieler 03", username: "", role: "Redstone" },
    { name: "Spieler 04", username: "", role: "Farmer" },
    { name: "Spieler 05", username: "", role: "Abenteurer" }
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
