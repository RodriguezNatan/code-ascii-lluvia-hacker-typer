import {validateBattle} from './combat.js';
import{TYPES,BY_ID,DRAW_TABLES,weighted,randomItem}from'./catalog.js';
import{validatePuzzles}from'./puzzles.js';
export const NORMAL_KEY='htis.normal.v1';
export const COMMANDS=['juegos','jugar','firewall','bots','laberinto','sudoku','tienda','armas','ropa','armaduras','escudos','habilidades','inventario','personaje','logros','misiones','enciclopedia','entrenamiento','ayuda'];
export function initial(){const inventory={},equipped={};TYPES.forEach((t,i)=>{const id=`${i}-0-0`;inventory[id]={count:1,upgrade:0};equipped[t]=id;});return{version:1,points:0,keys:0,level:1,xp:0,materials:0,inventory,equipped,stats:{bots:0,firewall:0,hard:0,dash:0,combo:0,maze:0,sudoku:0,white:0,dark:0},claimed:[],hintSeen:false,title:'Aprendiz',settings:{sound:false,accessible:false},sudoku:null,maze:null,activeBattle:null,legacy:[],settled:[]};}
export function validate(s){
 if(!s||s.version!==1)throw Error('Formato de guardado incompatible');
 if(s.stats){s.stats.white??=0;s.stats.dark??=0;}s.activeBattle??=null;s.legacy??=[];s.settled??=[];if(s.activeBattle)validateBattle(s.activeBattle);if(!Array.isArray(s.legacy)||s.legacy.some(id=>!BY_ID[id])||!Array.isArray(s.settled)||s.settled.length>1000||s.settled.some(id=>typeof id!=='string'))throw Error('Registro de combate inválido');
 for(const k of['points','keys','level','xp','materials'])if(!Number.isSafeInteger(s[k])||s[k]<0)throw Error(`Valor inválido: ${k}`);
 if(s.level<1||s.level>100||s.xp>=(150+20*(s.level-1))||s.level===100&&s.xp!==0)throw Error('Nivel/XP inválido');
 if(!s.inventory||!s.equipped||!s.stats||!Array.isArray(s.claimed)||s.claimed.some(x=>typeof x!=='string'))throw Error('Guardado incompleto');
 for(const[id,v]of Object.entries(s.inventory))if(!BY_ID[id]||!Number.isSafeInteger(v.count)||v.count<1||!Number.isInteger(v.upgrade)||v.upgrade<0||v.upgrade>10)throw Error('Objeto inválido');
 for(const t of TYPES)if(!s.inventory[s.equipped[t]]||BY_ID[s.equipped[t]].type!==t)throw Error('Equipamiento inválido');
 for(const k of Object.keys(initial().stats))if(!Number.isSafeInteger(s.stats[k])||s.stats[k]<0)throw Error('Estadísticas inválidas');
 if(typeof s.hintSeen!=='boolean'||typeof s.title!=='string'||!s.settings||typeof s.settings.sound!=='boolean'||typeof s.settings.accessible!=='boolean')throw Error('Ajustes inválidos');
 for(const key of['sudoku','maze'])if(s[key]!==null&&typeof s[key]!=='object')throw Error('Partida inválida');
 validatePuzzles(s);return s;
}
export class Store{
 constructor(storage,key=NORMAL_KEY){this.storage=storage;this.key=key;const raw=storage.getItem(key);this.state=raw?validate(JSON.parse(raw)):initial();}
 transact(fn){const next=structuredClone(this.state);const result=fn(next);validate(next);this.storage.setItem(this.key,JSON.stringify(next));this.state=next;return result;}
 export(){return JSON.stringify({format:'htis-export-v1',profile:this.key,state:this.state},null,2);}
 import(text){const data=JSON.parse(text);if(data.format!=='htis-export-v1'||data.profile!==this.key)throw Error('La copia pertenece a otro perfil o formato');const s=validate(data.state);this.storage.setItem(this.key,JSON.stringify(s));this.state=s;}
}
export function addKeys(s,n=1){if(!Number.isSafeInteger(n)||n<0)throw Error('Teclas inválidas');const before=Math.floor(s.keys/100);s.keys+=n;s.points+=Math.floor(s.keys/100)-before;}
export function validKey(e,mode){return mode==='terminal'&&e.key.length===1&&e.key!=='/'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey;}
export function addXP(s,n){s.xp+=n;while(s.level<100&&s.xp>=150+20*(s.level-1)){s.xp-=150+20*(s.level-1);s.level++;}if(s.level===100)s.xp=0;}
export function grant(s,item){if(s.inventory[item.id]){s.inventory[item.id].count++;s.materials+=2;}else s.inventory[item.id]={count:1,upgrade:0};if(Number.isInteger(item.upgrade)&&item.upgrade>=0&&item.upgrade<=10)s.inventory[item.id].upgrade=Math.max(s.inventory[item.id].upgrade,item.upgrade);}
export function spend(s,cost){if(!Number.isSafeInteger(cost)||cost<0||s.points<cost)throw Error('Puntos insuficientes');s.points-=cost;}
export function purchase(s,id){const item=BY_ID[id];if(!item||item.price===null)throw Error('No se vende directamente');spend(s,item.price);grant(s,item);}
export function draw(s,tier,count,type=null,rng=Math.random){if(!DRAW_TABLES[tier]||![1,10,100].includes(count)||type&&!TYPES.includes(type))throw Error('Sorteo inválido');spend(s,Math.round(tier*(type?1.1:1))*count);const items=[];for(let i=0;i<count;i++){const item=randomItem(weighted(DRAW_TABLES[tier],rng),type,rng);grant(s,item);items.push(item);}return items;}
export function equip(s,id){const item=BY_ID[id];if(!item||!s.inventory[id])throw Error('No posees ese objeto');if(s.level<item.level)throw Error(`Requiere nivel ${item.level}`);s.equipped[item.type]=id;}
export function upgrade(s,id){const v=s.inventory[id];if(!v||v.upgrade>=10)throw Error('Mejora no disponible');const mats=(v.upgrade+1)*2;if(s.materials<mats||v.count<2)throw Error(`Necesitas un duplicado y ${mats} materiales`);spend(s,(v.upgrade+1)*100);s.materials-=mats;v.count--;v.upgrade++;}
export function commandKind(raw){const c=raw.trim().toLowerCase().replace(/\s+/g,' ');if(c==='hackeo instantaneo nivel infinito')return'gift';if(c==='hackeo instantaneo')return'supreme';return COMMANDS.includes(c)?c:'unknown';}
export function reward(s,kind,difficulty,loot,rng=Math.random){
 if(kind==='training')return{points:0,xp:0,hint:false};
 let points=0,xp=0,item=null,hint=false;
 if(kind==='bot'){points=[500,2000,5000][difficulty];xp=[35,75,150][difficulty];s.stats.bots++;item=loot[Math.floor(rng()*loot.length)];}
 if(kind==='firewall'){points=[1000,5000,10000][difficulty];xp=[40,90,180][difficulty];s.stats.firewall++;if(difficulty===2){s.stats.hard++;if(!s.hintSeen){s.hintSeen=true;hint=true;}}}
 if(kind==='white'){s.stats.white++;points=100000;xp=400;item=randomItem(weighted([[10,45],[11,45],[12,10]],rng),null,rng);}
 if(kind==='dark'){s.stats.dark++;points=1000000;xp=700;item=randomItem(weighted([[12,70],[13,24],[14,3],[15,3]],rng),null,rng);}
 s.points+=points;addXP(s,xp);if(item)grant(s,item);return{points,xp,item,hint};
}
export const MISSIONS=[['bots',50,700],['bots',100,1200],['dash',100,150],['combo',50,200],['maze',10,250],['sudoku',10,250],['collection',500,1500],['keys',50000,500],['keys',1000,25],['keys',10000,150],['bots',1,50],['bots',10,250],['dash',20,50],['combo',10,75],['maze',3,100],['sudoku',3,100],['collection',25,100],['collection',100,500]].map(([stat,target,points])=>({id:`${stat}:${target}`,stat,target,points}));
export const MILESTONES={1:3,3:'points',5:3,10:'epicBW',25:6,50:'legendBW',100:9,250:'title'};
export function claim(s,id,rng=Math.random){if(s.claimed.includes(id))throw Error('Ya reclamado');let result;
 if(id.startsWith('hard:')){const n=Number(id.slice(5)),v=MILESTONES[n];if(v===undefined||s.stats.hard<n)throw Error('Hito pendiente');if(v==='points'){s.points+=1000;result='1000 puntos';}else if(v==='title'){s.title='Arquitecto del Firewall';result=s.title;}else{const c=v==='epicBW'?(rng()<.5?4:5):v==='legendBW'?(rng()<.5?7:8):v;const item=randomItem(c,null,rng);grant(s,item);result=item.name;}}
 else{const m=MISSIONS.find(x=>x.id===id);if(!m)throw Error('Misión inválida');const value=m.stat==='keys'?s.keys:m.stat==='collection'?Object.keys(s.inventory).length:s.stats[m.stat];if(value<m.target)throw Error('Misión pendiente');s.points+=m.points;result=`${m.points} puntos`;}
 s.claimed.push(id);return result;
}

export function settleBattle(s,b,won,rng=Math.random){if(s.settled.includes(b.id))throw Error('Combate ya liquidado');s.activeBattle=null;s.settled.push(b.id);s.settled=s.settled.slice(-1000);if(b.kind!=='training'){s.stats.dash+=b.usedDash;s.stats.combo+=b.combos;s.legacy=won?b.legacy:[];}return won?reward(s,b.kind,b.difficulty,b.loot,rng):{points:0,xp:0,hint:false};}
