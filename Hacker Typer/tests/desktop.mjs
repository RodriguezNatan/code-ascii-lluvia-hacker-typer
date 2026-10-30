import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';import{fileURLToPath}from'node:url';import path from'node:path';import{mkdir,writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const require=createRequire(import.meta.url),{_electron:electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));const results=[];await mkdir(path.join(root,'test-results'),{recursive:true});
const stamp=Date.now();let current;
function pass(message){results.push(message);console.log('PASS '+message);}
async function command(page,text){await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('/');await page.locator('#command').fill(text);await page.keyboard.press('Enter');}
async function launch(packaged,again=false){const env={...process.env,HTIS_TEST_PROFILE:path.join(root,'test-results',`profile-${packaged?'public':'dev'}-${stamp}`)};delete env.ELECTRON_RUN_AS_NODE;current=await electron.launch({executablePath:(packaged?(process.env.HTIS_PUBLIC_EXE||(existsSync(path.join(root,'../Windows/Hacker Typer.exe'))?path.join(root,'../Windows/Hacker Typer.exe'):path.join(root,'dist/Hacker-Typer-Windows/Hacker Typer.exe'))):path.join(root,'runtime/electron.exe')),args:packaged?['--dev']:[path.join(root,'desktop'),'--dev'],env,timeout:30000});const page=await current.firstWindow();await page.waitForSelector('#nav button:visible');return page;}
try{
 let page=await launch(true);const errors=[];page.on('pageerror',e=>errors.push(e.message));assert.equal(page.url(),'htis://game/index.html');pass('EXE público abre ventana propia sin localhost');
 assert.equal(await current.evaluate(({app})=>app.isPackaged),true);assert.equal(await page.evaluate(()=>typeof require),'undefined');assert.equal(await page.evaluate(()=>typeof process),'undefined');pass('Paquete real, renderer sin Node');
 await page.keyboard.type('a'.repeat(100));assert.equal(await page.locator('#points').textContent(),'1');pass('Entrada de teclado y puntos en aplicación');
 await command(page,'120426');assert.equal(await page.locator('#admin-toggle').count(),0);const status=await page.evaluate(async()=> (await fetch('htis://game/adminTools.js')).status);assert.equal(status,404);pass('EXE rechaza ADMIN incluso con argumento --dev');
 const blocked=await page.evaluate(async()=>{try{await fetch('https://example.com');return false;}catch{return true;}});assert(blocked);pass('Red externa bloqueada');
 await command(page,'entrenamiento');await page.locator('[data-slot="2"]').click();await page.locator('[data-action="atq"]').click();assert.equal(await page.locator('#arena').count(),1);await page.screenshot({path:path.join(root,'test-results/desktop-combat.png')});await page.locator('#close-panel').click();pass('Canvas y controles dentro del EXE');
 await command(page,'sudoku');await page.locator('[data-difficulty="0"]').click();assert.equal(await page.locator('[data-cell]').count(),81);await page.locator('#close-panel').click();pass('Sudoku dentro del EXE');
 await page.screenshot({path:path.join(root,'test-results/desktop.png')});assert.deepEqual(errors,[]);await current.close();current=null;
 page=await launch(true,true);assert.equal(await page.locator('#points').textContent(),'1');await current.close();current=null;pass('Partida persiste al cerrar y abrir EXE');
 page=await launch(false);await command(page,'120426');assert(await page.locator('#admin-toggle').isVisible());await page.locator('#phase1').click();await page.getByRole('button',{name:'6 ADMIN',exact:true}).click();await page.locator('[data-action="act"]').click();await page.waitForFunction(()=>document.querySelector('#result')?.textContent.includes('VICTORIA'));assert.equal(await page.locator('#points').textContent(),'100,000');pass('Desarrollo local: ADMIN y victoria de fase');
 await current.close();current=null;await writeFile(path.join(root,'test-results/desktop-report.json'),JSON.stringify({runtime:'Electron 45.0.0',results},null,2));
}finally{if(current)await current.close();}



