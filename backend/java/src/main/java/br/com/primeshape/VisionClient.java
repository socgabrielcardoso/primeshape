package br.com.primeshape;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

final class VisionClient {
    record Reply(int status, String body) {}
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final String base;
    private final String token;

    VisionClient() {
        token = System.getenv().getOrDefault("PRIMESHAPE_INTERNAL_TOKEN", "");
        if (token.length() < 32) throw new IllegalStateException("Inicie com python scripts/run.py.");
        base = "http://127.0.0.1:" + Integer.parseInt(System.getenv().getOrDefault("PRIMESHAPE_VISION_PORT", "8765"));
    }

    Reply call(String path, String method, byte[] data, String session, long frame) throws IOException, InterruptedException {
        var builder = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(8)).header("X-Internal-Token", token);
        if (session != null) builder.header("X-Session-Id", session).header("X-Frame-Id", Long.toString(frame));
        if (data == null) builder.method(method, HttpRequest.BodyPublishers.noBody());
        else builder.header("Content-Type", "image/jpeg").method(method, HttpRequest.BodyPublishers.ofByteArray(data));
        var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
        try (var body = response.body()) {
            byte[] bytes = body.readNBytes(2_097_153);
            if (bytes.length > 2_097_152) throw new IOException("Resposta da visão excede o limite.");
            String json = new String(bytes, StandardCharsets.UTF_8).trim();
            if (!json.startsWith("{") || !json.endsWith("}")) throw new IOException("Resposta da visão inválida.");
            return new Reply(response.statusCode(), json);
        }
    }
}
