package br.com.primeshape;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

final class SessionRegistry {
    static final long TTL_NANOS = 120_000_000_000L;
    private final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    static final class Session {
        final AtomicBoolean busy = new AtomicBoolean(false);
        volatile long touched = System.nanoTime();
        volatile long lastFrame = -1;
        volatile long frames;
        volatile double averageMillis;

        void complete(long frame, double millis) {
            lastFrame = frame;
            frames++;
            averageMillis += (millis - averageMillis) / Math.min(frames, 20);
            touched = System.nanoTime();
        }
    }

    synchronized String create() {
        prune();
        if (sessions.size() >= 4) throw new IllegalStateException("Limite de quatro sessões atingido. Encerre uma câmera ou aguarde dois minutos.");
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        sessions.put(token, new Session());
        return token;
    }

    Session get(String token) {
        if (token == null) return null;
        Session session = sessions.get(token);
        if (session != null && System.nanoTime() - session.touched > TTL_NANOS && !session.busy.get()) {
            sessions.remove(token, session);
            return null;
        }
        return session;
    }

    boolean remove(String token) {
        Session session = get(token);
        if (session == null) return true;
        if (!session.busy.compareAndSet(false, true)) return false;
        sessions.remove(token, session);
        return true;
    }

    private void prune() {
        long now = System.nanoTime();
        sessions.entrySet().removeIf(e -> now - e.getValue().touched > TTL_NANOS && !e.getValue().busy.get());
    }
}
