const {app,BrowserWindow,protocol,session,dialog}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
// Optional recovery for incompatible graphics drivers; preserves all security settings.
if(process.argv.includes('--software-rendering'))app.disableHardwareAcceleration();
const development=!app.isPackaged&&process.argv.includes('--dev');
const title='Hacker Typer · Infinite System'+(development?' — Desarrollo':'');
app.setName(development?'HackerTyperDevelopment':'HackerTyperInfiniteSystem');
if(process.env.HTIS_TEST_PROFILE)app.setPath('userData',path.resolve(process.env.HTIS_TEST_PROFILE));
else { const portable=path.join(app.isPackaged?path.dirname(process.execPath):path.resolve(__dirname,'..'),'datos',development?'desarrollo':'publico'); require('node:fs').mkdirSync(portable,{recursive:true}); app.setPath('userData',portable); }
protocol.registerSchemesAsPrivileged([{scheme:'htis',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const assets=app.isPackaged?path.join(__dirname,'game'):path.join(__dirname,'..',development?'development':'public');
const allowed=new Set(['index.html','mechanics.js','presentation.js','app.js','catalog.js','combat.js','puzzles.js','state.js','style.css',...(development?['adminTools.js']:[])]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'";
let window;
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.whenReady().then(async()=>{
 protocol.handle('htis',async request=>{try{const u=new URL(request.url),name=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';if(u.hostname!=='game'||!allowed.has(name))return new Response('No encontrado',{status:404});return new Response(await fs.readFile(path.join(assets,name)),{headers:{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'}});}catch{return new Response('No se pudo cargar el recurso',{status:500});}});
 session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('htis://game/')&&!details.url.startsWith('blob:htis://game/')}));
 window=new BrowserWindow({title,width:1360,height:920,minWidth:800,minHeight:600,backgroundColor:'#060d0b',show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:!app.isPackaged}});
 window.removeMenu();window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('htis://game/'))event.preventDefault();});
 window.once('ready-to-show',()=>window.show());
 window.webContents.on('did-fail-load',(_event,code,description)=>{if(code!==-3)dialog.showErrorBox('No se pudo iniciar el juego',description+'\nConserva el ejecutable junto a sus carpetas de recursos.');});
 session.defaultSession.on('will-download',(_event,item)=>item.setSaveDialogOptions({title:'Exportar partida',defaultPath:path.join(app.getPath('documents'),item.getFilename())}));
 await window.loadURL('htis://game/index.html');
}).catch(error=>{dialog.showErrorBox('Error de inicio',error.message);app.quit();});
app.on('window-all-closed',()=>app.quit());
}

