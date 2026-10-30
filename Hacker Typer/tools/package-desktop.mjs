import {cp,mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
let dest=path.join(root,'dist','Hacker-Typer-Windows');
try { const candidate=path.join(root,'..','Windows'); const pkg=JSON.parse(await readFile(path.join(candidate,'resources','app','package.json'),'utf8')); if(pkg.name==='hacker-typer-infinite-system')dest=candidate; } catch {}
await mkdir(dest,{recursive:true});
let reusable=false;try{const [a,b]=await Promise.all([readFile(path.join(root,'runtime','electron.exe')),readFile(path.join(dest,'Hacker Typer.exe'))]);reusable=a.equals(b);}catch{}
if(!reusable)await cp(path.join(root,'runtime'),dest,{recursive:true});
try{await unlink(path.join(dest,'resources','default_app.asar'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!reusable){try{await unlink(path.join(dest,'Hacker Typer.exe'));}catch(e){if(e.code!=='ENOENT')throw e;}await rename(path.join(dest,'electron.exe'),path.join(dest,'Hacker Typer.exe'));}
const appDir=path.join(dest,'resources','app');await mkdir(appDir,{recursive:true});
await cp(path.join(root,'desktop','main.cjs'),path.join(appDir,'main.cjs'));
await writeFile(path.join(appDir,'package.json'),JSON.stringify({name:'hacker-typer-infinite-system',productName:'Hacker Typer Infinite System',version:'0.3.0',main:'main.cjs'}));
await cp(path.join(root,'public'),path.join(appDir,'game'),{recursive:true});
for(const file of await readdir(path.join(appDir,'game'))){const text=await readFile(path.join(appDir,'game',file),'utf8');if(/120426|adminTools|htis\.admin/.test(text))throw Error('Private code in public package: '+file);}
await writeFile(path.join(dest,'LEEME.txt'),'HACKER TYPER: INFINITE SYSTEM\r\n\r\nAbre Hacker Typer.exe. No necesita Python, Node, Chrome ni Internet.\r\nConserva todos los archivos de esta carpeta junto al ejecutable.\r\nEsta es la version publica sin ADMIN.\r\nGuarda en datos\\publico junto al ejecutable. Usa Exportar partida para crear copias.\r\nAplicacion portable: no instala servicios ni modifica el registro.\r\nBuild de desarrollo sin firma digital; no es una certificacion de seguridad ni una version final del juego.\r\n');
console.log('Windows portable listo: '+path.join(dest,'Hacker Typer.exe'));
await writeFile(path.join(dest,'INICIAR-COMPATIBILIDAD.bat'),'@echo off\r\ncd /d "%~dp0"\r\nstart "" "Hacker Typer.exe" --software-rendering\r\n');

