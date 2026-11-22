import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { angle: fn } = await import('data:text/javascript,' + encodeURIComponent(source));
test('angle nan', () => { assert.equal(fn([NaN,0],[0,0],[1,1]),0); });
