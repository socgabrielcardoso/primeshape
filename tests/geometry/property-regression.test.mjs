import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../frontend/js/browser/geometry.js", import.meta.url), "utf8");
const { clamp, distance, ramp, point, angle, bounds, signal } = await import("data:text/javascript," + encodeURIComponent(source));
const near = (actual, expected, epsilon = 1e-10) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be close to ${expected}`);

test("distance preserves 2D Pythagorean norm at scale 1", () => { assert.equal(distance([-2,1],[1,5]),5); });
test("distance preserves 2D Pythagorean norm at scale 2", () => { assert.equal(distance([-4,2],[2,10]),10); });
