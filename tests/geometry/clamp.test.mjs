import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { clamp } = await import('data:text/javascript,' + encodeURIComponent(source));
test('clamp preserves values in unit interval', () => { for (const n of [0, 0.25, 0.5, 1]) assert.equal(clamp(n), n); });
test('clamp saturates out-of-range values', () => { assert.equal(clamp(-100), 0); assert.equal(clamp(100), 1); });
test('clamp rejects nonfinite values', () => { for (const n of [NaN, Infinity, -Infinity, undefined]) assert.equal(clamp(n), 0); });
