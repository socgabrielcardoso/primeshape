import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../frontend/js/browser/geometry.js", import.meta.url), "utf8");
const { clamp, distance, ramp, point, angle, bounds, signal } = await import("data:text/javascript," + encodeURIComponent(source));
const near = (actual, expected, epsilon = 1e-10) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be close to ${expected}`);

test("distance preserves 2D Pythagorean norm at scale 1", () => { assert.equal(distance([-2,1],[1,5]),5); });
test("distance preserves 2D Pythagorean norm at scale 2", () => { assert.equal(distance([-4,2],[2,10]),10); });
test("distance preserves 2D Pythagorean norm at scale 3", () => { assert.equal(distance([-6,3],[3,15]),15); });
test("distance preserves 2D Pythagorean norm at scale 4", () => { assert.equal(distance([-8,4],[4,20]),20); });
test("distance preserves 2D Pythagorean norm at scale 5", () => { assert.equal(distance([-10,5],[5,25]),25); });
test("distance preserves 2D Pythagorean norm at scale 6", () => { assert.equal(distance([-12,6],[6,30]),30); });
test("distance preserves 2D Pythagorean norm at scale 7", () => { assert.equal(distance([-14,7],[7,35]),35); });
test("distance preserves 2D Pythagorean norm at scale 8", () => { assert.equal(distance([-16,8],[8,40]),40); });
test("distance preserves 2D Pythagorean norm at scale 9", () => { assert.equal(distance([-18,9],[9,45]),45); });
test("distance preserves 2D Pythagorean norm at scale 10", () => { assert.equal(distance([-20,10],[10,50]),50); });
