package br.com.primeshape;

import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;

final class HttpSupport {
    private static final Set<String> HOSTS = Set.of("localhost", "127.0.0.1", "[::1]", "::1");

    static boolean loopbackUrl(String value) {
        try {
            URI uri = URI.create(value);
            return "http".equals(uri.getScheme()) && HOSTS.contains(uri.getHost()) && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null && (uri.getPath().isEmpty() || "/".equals(uri.getPath()));
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    static boolean prepare(HttpExchange exchange) throws IOException {
        String host = exchange.getRequestHeaders().getFirst("Host");
        if (host == null || !loopbackUrl("http://" + host)) {
            error(exchange, 403, "Host não permitido.");
            return false;
        }
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        if (origin != null) {
            if (!loopbackUrl(origin)) {
                error(exchange, 403, "Abra o frontend no Live Server em localhost ou 127.0.0.1.");
                return false;
            }
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
            exchange.getResponseHeaders().set("Vary", "Origin");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, X-Session-Id, X-Frame-Id");
            exchange.getResponseHeaders().set("Access-Control-Expose-Headers", "X-Analysis-Millis, X-Session-Frames");
            exchange.getResponseHeaders().set("Access-Control-Allow-Private-Network", "true");
            exchange.getResponseHeaders().set("Access-Control-Max-Age", "600");
        }
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return false;
        }
        return true;
    }

    static void error(HttpExchange exchange, int status, String message) throws IOException {
        send(exchange, status, Json.encode(Map.of("erro", message)));
    }

    static void send(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
