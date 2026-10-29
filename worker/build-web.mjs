// Package an explicit public asset allowlist for the existing Worker. Never upload source/server/dev/credentials.
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),out=join(root,'worker/site-assets');mkdirSync(out,{recursive:true});
for(const p of ['web','js','css','fonts','icon.png','icon-180.png','favicon-32.png','range-engine.html','version.json'])if(existsSync(join(root,p)))cpSync(join(root,p),join(out,p),{recursive:true});
// Frame CSP remains in range-engine.html; enforce it even when fetched as a static asset.
writeFileSync(join(out,'_headers'),'/range-engine.html\n  Content-Security-Policy: default-src \'none\'; script-src \'self\'; connect-src \'none\'; frame-src \'none\'; form-action \'none\'; base-uri \'none\'\n');
console.log('Website assets packaged; existing Telegram index and all private/server/test files excluded.');
