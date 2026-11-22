import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { angle } = await import('data:text/javascript,' + encodeURIComponent(source));
test('angle computes right and straight angles', () => { assert.ok(Math.abs(angle([1,0],[0,0],[0,1])-90)<1e-9); assert.ok(Math.abs(angle([-1,0],[0,0],[1,0])-180)<1e-9); });
test('angle rejects degenerate and invalid points', () => { assert.equal(angle([0,0],[0,0],[1,1]),0); assert.equal(angle([NaN,0],[0,0],[1,1]),0); assert.equal(angle([1],[0,0],[1,1]),0); });
