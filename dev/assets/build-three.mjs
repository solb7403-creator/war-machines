// Reproducible, pinned extension of the existing MIT Three.js r169 bundle. Build dependency only.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url)),temp=join(tmpdir(),'lunar-three-r169-tools');mkdirSync(temp,{recursive:true});
const versionOK=name=>{try{return JSON.parse(readFileSync(join(temp,'node_modules',name,'package.json'))).version===({three:'0.169.0',esbuild:'0.24.2'})[name];}catch{return false;}};
if(!versionOK('three')||!versionOK('esbuild'))execFileSync('npm',['install','--prefix',temp,'--no-audit','--no-fund','--package-lock=false','three@0.169.0','esbuild@0.24.2'],{stdio:'inherit'});
const {build}=await import(pathToFileURL(join(temp,'node_modules/esbuild/lib/main.js'))),names=JSON.parse(readFileSync(new URL('three-exports.json',import.meta.url)));
const r=await build({stdin:{contents:'export {'+names.join(',')+'} from '+JSON.stringify(join(temp,'node_modules/three/build/three.module.js'))+';',resolveDir:temp},bundle:true,format:'iife',globalName:'THREE',minify:true,target:'es2020',write:false,legalComments:'inline'});
writeFileSync(join(root,'js/vendor/three.lunar.min.js'),'/* three.js r169 custom build (MIT License, Copyright 2010-2024 three.js authors, https://github.com/mrdoob/three.js) */\n'+r.outputFiles[0].text);
writeFileSync(join(root,'js/vendor/THREE-LICENSE.txt'),readFileSync(join(temp,'node_modules/three/LICENSE')));
console.log('Built pinned Three r169; exports:',names.length);
