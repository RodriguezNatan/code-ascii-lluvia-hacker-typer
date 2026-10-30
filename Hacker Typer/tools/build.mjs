import{mkdir,readFile,writeFile,copyFile,readdir}from'node:fs/promises';
import{fileURLToPath}from'node:url';
import path from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=['mechanics.js','presentation.js','catalog.js','state.js','puzzles.js','combat.js','app.js','style.css'];
for(const name of['public','development']){
 const dest=path.join(root,name);await mkdir(dest,{recursive:true});
 for(const file of files)await copyFile(path.join(root,'src',file),path.join(dest,file));
 let html=await readFile(path.join(root,'src/index.html'),'utf8');html=html.replace('<!--DEV-->',name==='development'?'<script type="module" src="adminTools.js"></script>':'');await writeFile(path.join(dest,'index.html'),html);
 if(name==='development')await copyFile(path.join(root,'dev/adminTools.js'),path.join(dest,'adminTools.js'));
}
for(const name of await readdir(path.join(root,'public'))){if(![...files,'index.html'].includes(name))throw Error('Archivo inesperado en build pública: '+name);const text=await readFile(path.join(root,'public',name),'utf8');if(/120426|adminTools|htis\.admin/.test(text))throw Error('ADMIN filtrado en build pública');}
console.log('Build OK: public (sin ADMIN) y development (privada).');
