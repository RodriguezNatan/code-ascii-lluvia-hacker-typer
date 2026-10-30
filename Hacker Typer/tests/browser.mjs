import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const servers=[];
for(const [folder,port]of [['public',18180],['development',18181]]){const child=spawn(process.execPath,[fileURLToPath(new URL('../tools/serve.mjs',import.meta.url)),folder,String(port)],{windowsHide:true});servers.push(child);await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));});}
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
const checks=[];
function check(name){checks.push(name);console.log('PASS '+name);}
async function command(text){await page.locator('body').click({position:{x:10,y:10}});await page.keyboard.press('/');await page.locator('#command').fill(text);await page.keyboard.press('Enter');}
try{
 await page.goto('http://127.0.0.1:18180');await page.waitForSelector('#nav button:visible');
 await page.keyboard.type('a'.repeat(100));assert.equal(await page.locator('#points').textContent(),'1');check('100 teclas = 1 punto en navegador');
 await page.reload();assert.equal(await page.locator('#points').textContent(),'1');check('Persistencia tras recarga');
 await command('ayuda');assert.equal(await page.locator('#points').textContent(),'1');assert(!(await page.locator('#panel').innerText()).includes('hackeo instantaneo'));check('Comandos no suman teclas; ayuda no filtra secretos');
 await command('120426');assert.equal(await page.locator('#admin-toggle').count(),0);assert.equal((await page.request.get('http://127.0.0.1:18180/adminTools.js')).status(),404);check('ADMIN no disponible en build pública');
 await command('hackeo instantaneo nivel infinito');assert.equal(await page.locator('#points').textContent(),'1,000,001');assert.equal(await page.locator('#level').textContent(),'01');check('Comando secreto completo da puntos sin nivel');
 await command('tienda');await page.locator('#count').selectOption('10');await page.locator('#draw-type').selectOption('espadas');await page.locator('#draw').click();assert.equal(await page.locator('#points').textContent(),'998,901');assert((await page.locator('#draw-summary').textContent()).length>0);check('Sorteo ×10 con recargo, resumen y saldo');
 await command('inventario');assert(await page.locator('[data-equip]').count()>0);check('Inventario muestra objetos obtenidos');
 await command('entrenamiento');await page.locator('[data-slot="3"]').click();await page.locator('[data-action="def"]').click();await page.keyboard.press('ArrowRight');await page.screenshot({path:new URL('../test-results/combat.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});await page.locator('#close-panel').click();check('Combate Canvas, selección, defensa, movimiento y salida');
 await command('laberinto');await page.locator('[data-difficulty="0"]').click();assert.equal(await page.locator('#maze').count(),1);await page.keyboard.press('ArrowRight');await page.reload();await command('laberinto');await page.locator('#resume').click();assert.equal(await page.locator('#maze').count(),1);await page.locator('#close-panel').click();check('Laberinto guarda y reanuda');
 await command('sudoku');await page.locator('[data-difficulty="0"]').click();assert.equal(await page.locator('[data-cell]').count(),81);await page.locator('#hint').click();assert((await page.locator('#sudoku-result').textContent()).includes('1'));await page.reload();await command('sudoku');await page.locator('#resume').click();assert((await page.locator('#sudoku-result').textContent()).includes('1'));await page.locator('#close-panel').click();check('Sudoku, pista y reanudación');
 await page.locator('#access').click();assert(await page.locator('body').evaluate(el=>el.classList.contains('accessible')));await page.locator('#access').click();await page.screenshot({path:new URL('../test-results/terminal.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});check('Modo accesible y captura de terminal');
 const downloaded=page.waitForEvent('download');await page.locator('#export').click();const file=await downloaded;const savedPath=await file.path();await command('hackeo instantaneo nivel infinito');await page.locator('#import').setInputFiles(savedPath);await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Partida importada');assert.equal(await page.locator('#points').textContent(),'998,901');check('Exportación e importación real en navegador');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:fileURLToPath(new URL('../test-results/mobile.png',import.meta.url)),fullPage:true});await page.setViewportSize({width:1440,height:1000});check('Diseño móvil sin desbordamiento horizontal');
 await page.goto('http://127.0.0.1:18181');await page.waitForSelector('#nav button:visible');await command('120426');assert(await page.locator('#admin-toggle').isVisible());await page.locator('#phase1').click();await page.getByRole('button',{name:'6 ADMIN',exact:true}).click();await page.locator('[data-action="act"]').click();await page.waitForFunction(()=>document.querySelector('#result')?.textContent.includes('VICTORIA'));assert.equal(await page.locator('#points').textContent(),'100,000');await page.getByRole('button',{name:'Continuar: fase 2'}).click();await page.getByRole('button',{name:'6 ADMIN',exact:true}).click();await page.locator('[data-action="act"]').click();await page.waitForFunction(()=>document.querySelector('#result')?.textContent.includes('VICTORIA'));assert.equal(await page.locator('#points').textContent(),'1,100,000');check('ADMIN local: dos fases, recompensas acumuladas');
 await page.locator('#admin-toggle').click();await page.locator('#exit-admin').click();assert.equal(await page.locator('#points').textContent(),'0');check('Salir ADMIN restaura partida normal independiente');
 assert.deepEqual(errors,[]);check('Sin errores JavaScript de página');
 await writeFile(new URL('../test-results/browser-report.json',import.meta.url),JSON.stringify({checks,errors},null,2));
}finally{await browser.close();for(const child of servers)child.kill();}




