import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { ramp: fn } = await import('data:text/javascript,' + encodeURIComponent(source));
test('ramp interpolates within interval',()=>{assert.equal(fn(5,0,10),0.5);assert.equal(fn(-1,0,10),0);assert.equal(fn(11,0,10),1);});
test('ramp handles collapsed ranges',()=>{assert.equal(fn(5,5,5),1);assert.equal(fn(4,5,5),0);});
