import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../frontend/js/browser/geometry.js", import.meta.url), "utf8");
const { clamp, distance, ramp, point, angle, bounds, signal } = await import("data:text/javascript," + encodeURIComponent(source));
const near = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) <= epsilon, `Expected ${a} to be near ${b}`);

test("clamp bounds slight negative inputs", () => { assert.equal(clamp(-0.0001), 0); });
test("clamp bounds large negative inputs", () => { assert.equal(clamp(-1000000), 0); });
test("clamp preserves zero", () => { assert.equal(clamp(0), 0); });
test("clamp preserves a small fraction", () => { assert.equal(clamp(0.125), 0.125); });
test("clamp preserves the midpoint", () => { assert.equal(clamp(0.5), 0.5); });
