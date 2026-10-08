package br.com.primeshape;

import java.util.HashSet;
import java.util.Set;

/** Dependency-free checks for the Java gateway's local security boundary. */
public final class GatewayRegressionTest {
    private GatewayRegressionTest() {}

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void testLoopbackOnly() {
        for (String accepted : new String[] {
            "http://localhost", "http://localhost:5500", "http://127.0.0.1:8080",
            "http://[::1]:8765"
        }) check(HttpSupport.loopbackUrl(accepted), "Must accept local URL: " + accepted);

        for (String rejected : new String[] {
            "https://localhost", "http://example.org", "http://127.0.0.2",
            "http://localhost.evil.invalid", "http://localhost/path",
            "http://localhost/?token=x", "http://username@localhost",
            "file:///etc/passwd", "invalid"
        }) check(!HttpSupport.loopbackUrl(rejected), "Must reject URL: " + rejected);
    }

    private static void testSessionCapacityAndEntropy() {
        SessionRegistry registry = new SessionRegistry();
        Set<String> ids = new HashSet<>();
        for (int index = 0; index < 4; index++) {
            String id = registry.create();
            check(id.matches("[a-f0-9]{64}"), "Session id must be a 256-bit hex token");
            check(ids.add(id), "Session ids must be unique");
            check(registry.get(id) != null, "New session should resolve");
        }
        boolean rejected = false;
        try { registry.create(); } catch (IllegalStateException expected) { rejected = true; }
        check(rejected, "Too many sessions must fail");
        String removed = ids.iterator().next();
        check(registry.remove(removed), "Idle session should be removable");
        check(registry.get(removed) == null, "Removed session must not resolve");
        check(registry.create().matches("[a-f0-9]{64}"), "Capacity must be recovered");
        check(registry.remove("not-a-session"), "Unknown token deletion is idempotent");
    }

    private static void testExpirationWithBusySession() {
        SessionRegistry registry = new SessionRegistry();
        String id = registry.create();
        SessionRegistry.Session session = registry.get(id);
        session.touched = System.nanoTime() - SessionRegistry.TTL_NANOS - 1_000_000L;
        session.busy.set(true);
        check(registry.get(id) == session, "Do not evict a busy session");
        check(!registry.remove(id), "Do not remove a busy session");
        session.busy.set(false);
        check(registry.get(id) == null, "Expired idle session must be evicted");
    }

    public static void main(String[] args) {
        testLoopbackOnly();
        testSessionCapacityAndEntropy();
        testExpirationWithBusySession();
        System.out.println("Java gateway regression checks passed");
    }
}
