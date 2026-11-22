import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { bounds: fn } = await import('data:text/javascript,' + encodeURIComponent(source));
test('bounds negative', () => { assert.deepEqual(fn([[-4,-3],[-1,-1]]),[-4,-3,3,2]); });
