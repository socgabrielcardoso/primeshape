import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { point: fn } = await import('data:text/javascript,' + encodeURIComponent(source));
test('point null depth', () => { assert.deepEqual(fn({x:1,y:2,z:null}),[1,2,0]); });
