import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const meta=await (await fetch('https://registry.npmjs.org/electron/latest')).json();
const version=meta.version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid stable version');
const name=`electron-v${version}-win32-x64.zip`,base=`https://github.com/electron/electron/releases/download/v${version}/`;
await mkdir(new URL('runtime-download/',root),{recursive:true});
const checksResponse=await fetch(base+'SHASUMS256.txt');if(!checksResponse.ok)throw Error('Checksum download failed');
const checks=await checksResponse.text();const expected=checks.split('\n').find(l=>l.endsWith(name))?.split(/\s+/)[0];if(!expected)throw Error('Missing official hash');
const dest=new URL('runtime-download/'+name,root);let bytes;
try{bytes=await readFile(dest);}catch{const response=await fetch(base+name);if(!response.ok)throw Error('Runtime download '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
const actual=createHash('sha256').update(bytes).digest('hex');if(actual!==expected)throw Error('Runtime hash mismatch');
await writeFile(dest,bytes);await writeFile(new URL('runtime-download/runtime.json',root),JSON.stringify({version,name,sha256:actual,url:base+name},null,2));console.log(JSON.stringify({version,file:fileURLToPath(dest),sha256:actual,bytes:bytes.length}));
