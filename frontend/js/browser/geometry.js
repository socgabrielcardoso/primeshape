export const clamp = value => Math.max(0, Math.min(1, value));
export const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
export const ramp = (value, low, high) => clamp((value - low) / (high - low));
export const point = p => [p.x, p.y, p.z || 0];
export function angle(a, b, c) {
  const u = a.map((value, i) => value - b[i]);
  const v = c.map((value, i) => value - b[i]);
  return Math.acos(Math.max(-1, Math.min(1, u.reduce((sum, value, i) => sum + value * v[i], 0) / Math.max(Math.hypot(...u) * Math.hypot(...v), 1e-8)))) * 180 / Math.PI;
}
export function bounds(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}
export const signal = (codigo, rotulo, score = 1, tipo = "medicao", evidencias = []) => ({ codigo, rotulo, score: clamp(score), tipo, evidencias });
