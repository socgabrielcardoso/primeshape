import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../frontend/js/browser/geometry.js', import.meta.url), 'utf8');
const { signal: fn } = await import('data:text/javascript,' + encodeURIComponent(source));
test('signal returns structured measurement',()=>{assert.deepEqual(fn('A','label',0.7),{codigo:'A',rotulo:'label',score:0.7,tipo:'medicao',evidencias:[]});});
test('signal clamps confidence score',()=>{assert.equal(fn('A','label',2).score,1);assert.equal(fn('A','label',-1).score,0);});
