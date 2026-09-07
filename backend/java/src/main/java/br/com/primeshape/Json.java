package br.com.primeshape;

import java.util.Map;
import java.util.stream.Collectors;

final class Json {
    private Json() {}

    static String encode(Object value) {
        if (value == null) return "null";
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Number number) {
            return Double.isFinite(number.doubleValue()) ? number.toString() : "null";
        }
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream().map(e -> encode(e.getKey().toString()) + ":" + encode(e.getValue())).collect(Collectors.joining(",", "{", "}"));
        }
        if (value instanceof Iterable<?> values) {
            var result = new StringBuilder("[");
            for (Object item : values) {
                if (result.length() > 1) result.append(',');
                result.append(encode(item));
            }
            return result.append(']').toString();
        }
        var result = new StringBuilder("\"");
        for (char c : value.toString().toCharArray()) {
            switch (c) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> {
                    if (c < 32) result.append(String.format("\\u%04x", (int) c));
                    else result.append(c);
                }
            }
        }
        return result.append('"').toString();
    }
}
