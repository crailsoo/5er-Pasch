package de.fivepasch.playersync;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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

    @Override
    public void onEnable() {
        saveDefaultConfig();
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
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent ignored) {
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
            if (retryAfterSend.getAndSet(false) && isEnabled()) {
                getServer().getScheduler().runTask(this, this::scheduleSnapshot);
            }
        });
    }

    private static void putIfValid(Map<String, String> target, String uuid, String username) {
        if (username != null && USERNAME.matcher(username).matches()) {
            target.put(uuid.toLowerCase(Locale.ROOT), username);
        }
    }
}
