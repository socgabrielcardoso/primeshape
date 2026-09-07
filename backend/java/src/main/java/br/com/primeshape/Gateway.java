package br.com.primeshape;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public final class Gateway {
    private final SessionRegistry sessions = new SessionRegistry();
    private final VisionClient vision = new VisionClient();

    public static void main(String[] args) throws IOException {
        System.setProperty("sun.net.httpserver.maxReqTime", "10");
        System.setProperty("sun.net.httpserver.maxRspTime", "15");
        int port = Integer.parseInt(System.getenv().getOrDefault("PRIMESHAPE_API_PORT", "8080"));
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 16);
        var executor = new ThreadPoolExecutor(4, 8, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(16), new ThreadPoolExecutor.CallerRunsPolicy());
        server.setExecutor(executor);
        var gateway = new Gateway();
        server.createContext("/", gateway::handle);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            server.stop(1);
            executor.shutdownNow();
        }));
        server.start();
        System.out.println("PrimeShape Java pronto em http://127.0.0.1:" + port);
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            if (!HttpSupport.prepare(exchange)) return;
            route(exchange);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            HttpSupport.error(exchange, 503, "Análise interrompida.");
        } catch (IllegalArgumentException error) {
            HttpSupport.error(exchange, 400, "Parâmetro de requisição inválido.");
        } catch (IllegalStateException error) {
            HttpSupport.error(exchange, 429, error.getMessage());
        } catch (IOException error) {
            HttpSupport.error(exchange, 503, "Serviço Python indisponível ou excedeu o tempo limite. Verifique o terminal.");
        } finally {
            exchange.close();
        }
    }

    private void route(HttpExchange exchange) throws IOException, InterruptedException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        if (path.equals("/api/health") && method.equals("GET")) {
            var reply = vision.call("/health", "GET", null, null, 0);
            HttpSupport.send(exchange, reply.status(), "{\"java\":\"pronto\",\"visao\":" + reply.body() + "}");
        } else if (path.equals("/api/capabilities") && method.equals("GET")) {
            var reply = vision.call("/capabilities", "GET", null, null, 0);
            HttpSupport.send(exchange, reply.status(), reply.body());
        } else if (path.equals("/api/sessions") && method.equals("POST")) {
            var reply = vision.call("/health", "GET", null, null, 0);
            if (reply.status() != 200) { HttpSupport.send(exchange, reply.status(), reply.body()); return; }
            HttpSupport.send(exchange, 201, Json.encode(Map.of("sessao_id", sessions.create(), "expira_em_s", 120)));
        } else if (path.equals("/api/sessions") && method.equals("DELETE")) {
            String token = exchange.getRequestHeaders().getFirst("X-Session-Id");
            if (token == null || !token.matches("[a-f0-9]{64}")) { HttpSupport.error(exchange, 400, "Sessão inválida."); return; }
            if (!sessions.remove(token)) { HttpSupport.error(exchange, 409, "Aguarde o quadro em processamento."); return; }
            vision.call("/sessions/" + token, "DELETE", null, null, 0);
            HttpSupport.send(exchange, 200, Json.encode(Map.of("status", "encerrada")));
        } else if (path.equals("/api/analyze") && method.equals("POST")) {
            analyze(exchange);
        } else {
            HttpSupport.error(exchange, path.startsWith("/api/") ? 405 : 404, "Rota ou método não disponível.");
        }
    }

    private void analyze(HttpExchange exchange) throws IOException, InterruptedException {
        String token = exchange.getRequestHeaders().getFirst("X-Session-Id");
        var session = sessions.get(token);
        if (session == null) { HttpSupport.error(exchange, 401, "Sessão expirada. Reinicie a análise."); return; }
        String frameHeader = exchange.getRequestHeaders().getFirst("X-Frame-Id");
        if (frameHeader == null || !frameHeader.matches("[0-9]{1,12}")) { HttpSupport.error(exchange, 400, "Quadro inválido."); return; }
        long frame = Long.parseLong(frameHeader);
        if (!session.busy.compareAndSet(false, true)) { HttpSupport.error(exchange, 429, "Aguarde o quadro anterior."); return; }
        try {
            if (frame <= session.lastFrame) { HttpSupport.error(exchange, 409, "Quadro repetido ou fora de ordem."); return; }
            if (!"image/jpeg".equals(exchange.getRequestHeaders().getFirst("Content-Type"))) { HttpSupport.error(exchange, 415, "Envie image/jpeg."); return; }
            byte[] bytes = exchange.getRequestBody().readNBytes(1_048_577);
            if (bytes.length > 1_048_576) { HttpSupport.error(exchange, 413, "Quadro maior que 1 MiB."); return; }
            long started = System.nanoTime();
            var reply = vision.call("/analyze", "POST", bytes, token, frame);
            double millis = (System.nanoTime() - started) / 1_000_000.0;
            if (reply.status() == 200) session.complete(frame, millis);
            exchange.getResponseHeaders().set("X-Analysis-Millis", Long.toString(Math.round(millis)));
            exchange.getResponseHeaders().set("X-Session-Frames", Long.toString(session.frames));
            HttpSupport.send(exchange, reply.status(), reply.body());
        } finally {
            session.busy.set(false);
        }
    }
}
