import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {_electron}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const env={...process.env,HTIS_TEST_PROFILE:path.join(root,'test-results','profile-software-'+Date.now())};
delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve(root,'../Windows/Hacker Typer.exe'),args:['--software-rendering'],env});
try {
 const page=await app.firstWindow();await page.waitForSelector('#nav button:visible');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.keyboard.type('a'.repeat(100));assert.equal(await page.locator('#points').textContent(),'1');
 await page.keyboard.press('/');await page.locator('#command').fill('entrenamiento');await page.keyboard.press('Enter');
 assert.equal(await page.locator('#arena').count(),1);
 const gpu=await app.evaluate(({app})=>app.getGPUFeatureStatus());
 assert.match(gpu.gpu_compositing,/disabled|software/);
 assert.deepEqual(errors,[]);
 await writeFile(path.join(root,'test-results/windows-compatibility.json'),JSON.stringify({results:['Arranque Windows con renderizado por software','100 teclas = 1 punto','Arena Canvas disponible','Sin errores JavaScript'],gpu},null,2));
 console.log('PASS modo de compatibilidad Windows, terminal, Canvas y GPU software');
} finally {await app.close();}
