import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { distance } = await import('data:text/javascript,' + encodeURIComponent(source));
const fn = distance;
test('distance nan', () => { assert.equal(fn([NaN],[1]),Infinity); });
