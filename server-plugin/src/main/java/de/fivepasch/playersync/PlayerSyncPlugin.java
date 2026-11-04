package de.fivepasch.playersync;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.Statistic;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

/** Sends public player names and online presence to the private Cloudflare write endpoint. */
public final class PlayerSyncPlugin extends JavaPlugin implements Listener {
    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_]{3,16}");
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final AtomicBoolean sending = new AtomicBoolean(false);
    private final AtomicBoolean retryAfterSend = new AtomicBoolean(false);
    private BukkitTask queued;
    private File eventsFile;
    private final List<Map<String, String>> pendingEvents = new ArrayList<>();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        loadPendingEvents();
        getServer().getPluginManager().registerEvents(this, this);
        int seconds = Math.max(120, getConfig().getInt("heartbeat-seconds", 300));
        getServer().getScheduler().runTaskLater(this, this::publishSnapshot, 40L);
        getServer().getScheduler().runTaskTimer(this, this::publishSnapshot,
                seconds * 20L, seconds * 20L);
        if (!isConfigured()) {
            getLogger().warning("Bitte endpoint und token in plugins/5erPaschPlayerSync/config.yml konfigurieren.");
        } else {
            getLogger().info("Player-Sync bereit (alle " + seconds + " Sekunden sowie bei Join/Leave).");
        }
    }

    @Override
    public void onDisable() {
        if (queued != null) queued.cancel();
        savePendingEvents();
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (getConfig().getBoolean("chronicle-enabled", true) &&
                !event.getPlayer().hasPlayedBefore()) {
            String name = event.getPlayer().getName();
            recordEvent("join", name, "Neues Mitglied: " + name,
                    name + " ist der Minecraft-Welt von 5er Pasch beigetreten.");
        }
        scheduleSnapshot();
    }

    @EventHandler
    public void onAdvancement(PlayerAdvancementDoneEvent event) {
        if (!getConfig().getBoolean("chronicle-enabled", true)) return;
        String key = event.getAdvancement().getKey().toString();
        String label = switch (key) {
            case "minecraft:story/mine_diamond" -> "Diamanten gefunden";
            case "minecraft:story/enter_the_nether" -> "Das Nether betreten";
            case "minecraft:nether/find_fortress" -> "Netherfestung entdeckt";
            case "minecraft:nether/obtain_ancient_debris" -> "Antiken Schrott gefunden";
            case "minecraft:nether/netherite_armor" -> "Netherit-Rüstung hergestellt";
            case "minecraft:end/enter_end_gateway" -> "End-Gateway erkundet";
            case "minecraft:end/kill_dragon" -> "Der Enderdrache wurde besiegt";
            case "minecraft:adventure/adventuring_time" -> "Die Welt erkundet";
            case "minecraft:nether/return_to_sender" -> "Ghast-Geschoss zurückgeschickt";
            default -> null;
        };
        if (label == null) return;
        String name = event.getPlayer().getName();
        recordEvent("advancement", name, label,
                name + " hat den Fortschritt „" + label + "“ erreicht.");
        scheduleSnapshot();
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent ignored) {
        // Delay so the leaving player is already removed from Bukkit.getOnlinePlayers().
        scheduleSnapshot();
    }

    private void scheduleSnapshot() {
        if (queued != null) queued.cancel();
        queued = getServer().getScheduler().runTaskLater(this, () -> {
            queued = null;
            publishSnapshot();
        }, 60L);
    }

    // Sparse important milestones are persisted locally until Cloudflare confirms receipt.
    private void recordEvent(String type, String username, String title, String description) {
        if (!USERNAME.matcher(username).matches()) return;
        Map<String, String> event = new HashMap<>();
        event.put("id", UUID.randomUUID().toString());
        event.put("type", type);
        event.put("title", title);
        event.put("description", description);
        event.put("occurredAt", Instant.now().toString());
        pendingEvents.add(event);
        while (pendingEvents.size() > 80) pendingEvents.remove(0);
        savePendingEvents();
    }

    private void loadPendingEvents() {
        eventsFile = new File(getDataFolder(), "pending-events.yml");
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(eventsFile);
        for (Map<?, ?> raw : yaml.getMapList("events")) {
            Map<String, String> e = new HashMap<>();
            for (String key : List.of("id", "type", "title", "description", "occurredAt")) {
                Object value = raw.get(key);
                if (value instanceof String) e.put(key, (String) value);
            }
            if (e.size() == 5) pendingEvents.add(e);
        }
        while (pendingEvents.size() > 80) pendingEvents.remove(0);
    }

    private void savePendingEvents() {
        if (eventsFile == null) return;
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("events", new ArrayList<>(pendingEvents));
        try {
            yaml.save(eventsFile);
        } catch (IOException ex) {
            getLogger().warning("Konnte ausstehende Chronik-Ereignisse nicht sichern.");
        }
    }

    private static int stat(OfflinePlayer player, Statistic statistic) {
        try {
            return Math.max(0, player.getStatistic(statistic));
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private boolean isConfigured() {
        String endpoint = getConfig().getString("endpoint", "").trim();
        String token = getConfig().getString("token", "").trim();
        try {
            URI uri = URI.create(endpoint);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getFragment() == null
                    && uri.getPath().endsWith("/api/players")
                    && token.length() >= 32 && !token.equals("SET_SECRET_HERE");
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    /** Called from Bukkit's main thread; HTTP request itself is fully asynchronous. */
    private void publishSnapshot() {
        if (!isConfigured()) return;
        if (!sending.compareAndSet(false, true)) {
            retryAfterSend.set(true);
            return;
        }

        // Read Bukkit data ONLY on the main thread.
        Map<String, String> known = new LinkedHashMap<>();
        for (OfflinePlayer player : Bukkit.getOfflinePlayers()) {
            putIfValid(known, player.getUniqueId().toString(), player.getName());
        }
        Map<String, String> online = new LinkedHashMap<>();
        for (Player player : Bukkit.getOnlinePlayers()) {
            String uuid = player.getUniqueId().toString();
            String name = player.getName();
            putIfValid(known, uuid, name);
            putIfValid(online, uuid, name);
        }

        StringBuilder body = new StringBuilder("{\"players\":[");
        boolean first = true;
        for (Map.Entry<String, String> entry : known.entrySet()) {
            if (!first) body.append(',');
            first = false;
            body.append("{\"uuid\":\"").append(entry.getKey())
                    .append("\",\"username\":\"").append(entry.getValue()).append("\"}");
        }
        body.append("],\"online\":[");
        first = true;
        for (String username : online.values()) {
            if (!first) body.append(',');
            first = false;
            body.append('"').append(username).append('"');
        }
        body.append("],\\\"stats\\\":[");
        first = true;
        for (OfflinePlayer player : Bukkit.getOfflinePlayers()) {
            String name = player.getName();
            if (name == null || !USERNAME.matcher(name).matches()) continue;
            if (!first) body.append(',');
            first = false;
            body.append("{\\\"uuid\\\":\\\"").append(player.getUniqueId())
                    .append("\\\",\\\"playTicks\\\":").append(stat(player, Statistic.PLAY_ONE_MINUTE))
                    .append(",\\\"deaths\\\":").append(stat(player, Statistic.DEATHS))
                    .append(",\\\"mobKills\\\":").append(stat(player, Statistic.MOB_KILLS))
                    .append(",\\\"walkedCm\\\":").append(stat(player, Statistic.WALK_ONE_CM))
                    .append(",\\\"jumps\\\":").append(stat(player, Statistic.JUMP)).append('}');
        }
        body.append("],\\\"events\\\":[");
        first = true;
        List<String> sentEventIds = new ArrayList<>();
        for (Map<String, String> event : pendingEvents) {
            if (!first) body.append(',');
            first = false;
            body.append('{');
            boolean firstField = true;
            for (String field : List.of("id", "type", "title", "description", "occurredAt")) {
                if (!firstField) body.append(',');
                firstField = false;
                body.append('\\\"').append(field).append("\\\":\\\"")
                        .append(jsonEscape(event.get(field))).append('\\\"');
            }
            body.append('}');
            sentEventIds.add(event.get("id"));
        }
        body.append("]}");

        String endpoint = getConfig().getString("endpoint", "").trim();
        String token = getConfig().getString("token", "").trim();
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + token)
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                    .build();
        } catch (RuntimeException error) {
            sending.set(false);
            getLogger().warning("Ungültige Synchronisierungs-Konfiguration.");
            return;
        }

        client.sendAsync(request, HttpResponse.BodyHandlers.discarding()).whenComplete((response, error) -> {
            sending.set(false);
            if (error != null) {
                getLogger().warning("Spieler-Sync fehlgeschlagen: " + error.getClass().getSimpleName());
            } else if (response.statusCode() / 100 != 2) {
                getLogger().warning("Spieler-Sync: Cloudflare HTTP " + response.statusCode()
                        + " (Bindings und Secret prüfen).");
            }
            if (error == null && response != null && response.statusCode() / 100 == 2
                    && !sentEventIds.isEmpty() && isEnabled()) {
                try {
                    getServer().getScheduler().runTask(this, () -> {
                        Set<String> confirmed = new HashSet<>(sentEventIds);
                        pendingEvents.removeIf(e -> confirmed.contains(e.get("id")));
                        savePendingEvents();
                    });
                } catch (RuntimeException ignored) { /* shutdown */ }
            }
            if (retryAfterSend.getAndSet(false) && isEnabled()) {
                getServer().getScheduler().runTask(this, this::scheduleSnapshot);
            }
        });
    }

    private static String jsonEscape(String value) {
        if (value == null) return "";
        return value.replace("\\\\", "\\\\\\\\").replace("\\\"", "\\\\\\")
                .replace("\\n", " ").replace("\\r", " ");
    }

    private static void putIfValid(Map<String, String> target, String uuid, String username) {
        if (username != null && USERNAME.matcher(username).matches()) {
            target.put(uuid.toLowerCase(Locale.ROOT), username);
        }
    }
}
