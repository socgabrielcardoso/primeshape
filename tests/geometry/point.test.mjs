import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { point: fn } = await import('data:text/javascript,' + encodeURIComponent(source));
test('point preserves coordinates and defaults depth',()=>{assert.deepEqual(fn({x:1,y:2}),[1,2,0]);assert.deepEqual(fn({x:1,y:2,z:3}),[1,2,3]);});
test('point does not throw on missing landmark',()=>{assert.deepEqual(fn(null),[undefined,undefined,0]);});
