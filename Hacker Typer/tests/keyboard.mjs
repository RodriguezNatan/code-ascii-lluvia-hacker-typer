import {createRequire} from 'node:module';import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{_electron}=require(process.env.PLAYWRIGHT_MODULE);
const root='G:/Proyectos/Hacker-Typer/VS';const env={...process.env,HTIS_TEST_PROFILE:root+'/test-results/profile-keyboard-'+Date.now()};for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','VSCODE_INSPECTOR_OPTIONS'])delete env[k];
const app=await _electron.launch({executablePath:root+'/runtime/electron.exe',args:[root+'/desktop','--dev'],env});
try{const p=await app.firstWindow();await p.waitForSelector('#nav button:visible');
await p.getByRole('button',{name:'ENTRENAMIENTO',exact:true}).click();
const state=()=>p.evaluate(async()=>{const {developmentAPI:a}=await import('./app.js');return {x:a.battle.player.x,y:a.battle.player.y,slot:a.battle.slot,dash:a.battle.cd.dash,paused:a.battle.paused,keys:a.store.state.keys,uses:a.battle.player.commandUse};});
const before=await state();await p.locator('#combat-command').focus();await p.keyboard.press('ArrowRight');assert.equal((await state()).x,before.x+1);
await p.waitForTimeout(140);await p.keyboard.press('ArrowLeft');assert.equal((await state()).x,before.x);
await p.locator('[data-slot="2"]').click();await p.keyboard.press('Space');await p.keyboard.press('Shift');assert((await state()).dash>0);
await p.keyboard.press('5');assert.equal((await state()).slot,5);await p.keyboard.press('p');assert((await state()).paused);await p.keyboard.press('p');assert(!(await state()).paused);
await p.keyboard.type('def');await p.keyboard.press('Enter');assert.equal((await state()).keys,before.keys);
await p.locator('#close-panel').click();await p.getByRole('button',{name:'LABERINTO',exact:true}).click();await p.locator('[data-difficulty="0"]').click();
const maze=()=>p.evaluate(async()=>{const {developmentAPI:a}=await import('./app.js');return a.store.state.maze;});const m=await maze();const right=m.grid[m.y][m.x+1]===0;await p.keyboard.press(right?'ArrowRight':'ArrowDown');const n=await maze();assert(n.x!==m.x||n.y!==m.y);
await p.locator('#close-panel').click();await p.getByRole('button',{name:'SUDOKU',exact:true}).click();await p.locator('[data-difficulty="0"]').click();await p.locator('[data-cell="0"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator(':focus').getAttribute('data-cell'),'1');
await writeFile(root+'/test-results/keyboard-report.json',JSON.stringify({passed:['Flechas con campo enfocado','Movimiento inverso','Dash con Shift','Ranuras numéricas','Pausa P','Combate no suma teclas','Laberinto con flechas','Sudoku con flechas']},null,2));console.log('PASS controles de teclado Windows');
}finally{await app.close();}
