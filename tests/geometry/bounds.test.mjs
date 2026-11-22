import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { bounds } = await import('data:text/javascript,' + encodeURIComponent(source));
test('bounds returns origin and dimensions', () => { assert.deepEqual(bounds([[2,3],[7,11],[-1,4]]),[-1,3,8,8]); });
test('bounds ignores malformed landmarks', () => { assert.deepEqual(bounds([[1,2],[NaN,3],null,[4,6]]),[1,2,3,4]); });
test('bounds handles empty and invalid sets', () => { assert.deepEqual(bounds([]),[0,0,0,0]); assert.deepEqual(bounds([[NaN,0],null]),[0,0,0,0]); });
