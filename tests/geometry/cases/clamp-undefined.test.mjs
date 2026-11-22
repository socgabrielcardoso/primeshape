import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { clamp } = await import('data:text/javascript,' + encodeURIComponent(source));
const fn = clamp;
test('clamp undefined', () => { assert.equal(fn(undefined),0); });
