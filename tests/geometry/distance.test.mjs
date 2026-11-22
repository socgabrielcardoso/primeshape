import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { distance } = await import('data:text/javascript,' + encodeURIComponent(source));
test('distance computes euclidean length', () => { assert.equal(distance([0,0], [3,4]), 5); assert.equal(distance([1,2,3], [1,2,3]), 0); });
test('distance rejects malformed vectors', () => { for (const [a,b] of [[null,[1]], [[],[]], [[1],[1,2]], [[NaN],[1]], [[Infinity],[1]]]) assert.equal(distance(a,b), Infinity); });
