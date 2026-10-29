// Approved LUNAR Defender flagship: real THREE geometry in the same model kit that
// powers both showroom and live matches. No screenshot mocks or gameplay rewrites.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInContext,createContext} from 'node:vm';

const root=new URL('../../',import.meta.url);
const vendor=readFileSync(new URL('js/vendor/three.lunar.min.js',root),'utf8');
const source=readFileSync(new URL('js/models3d.js',root),'utf8');
const rules=readFileSync(new URL('js/rules.js',root),'utf8');
const context=createContext({console});
runInContext(vendor,context,{timeout:15000});
assert.ok(context.THREE?.BufferGeometry,'the actual vendored THREE runtime is required');
runInContext(