import {DELIVERIES,EFFECT_DETAILS,SCHOOLS} from './mechanics.js';
export const TYPES=['espadas','pistolas','escudos','armaduras','ropa','tecnicas','especiales'];
export const CLASSES=['Normal','Raro','Especial','Épico','Black Épico','White Épico','Legendario','Black Legendario','White Legendario','Mítico','Black Mítico','White Mítico','Semiheroico','Heroico','Black Heroico','White Heroico'];
export const COUNTS=[50,50,50,50,20,20,20,20,20,20,20,20,20,20,10,10];
export const PRICES=[100,500,1000,2500,5000,5000,10000,25000,25000,50000,100000,100000,null,null,null,null];
export const POWER=[1,1.3,1.6,2,2.3,2.3,2.7,3,3,3.5,4,4,4.5,5,5.5,5.5];
export const TRIGGERS=['hit','act','dash','block','hurt','combo','low','far','near','period','kill'];
export const EFFECTS=['heal','ward','burn','slow','nova','pierce','leech','haste','focus','frost','reflect','stun','regen','execute','cleanse','reach','armor','charge','echo','vortex'];
export const EFFECT_NAMES=['Reparación','Barrera','Incendio','Retardo','Pulso','Perforación','Drenaje','Aceleración','Precisión','Congelación','Reflejo','Interrupción','Regeneración','Remate','Purificación','Extensión','Fortificación','Carga','Eco','Atracción'];
export const TRIGGER_NAMES=['al impactar','al activar','al esquivar','al bloquear','al recibir daño','en combo','con poca vida','a distancia','de cerca','periódica','al vencer'];
const roots=['Vector','Nexo','Prisma','Órbita','Cifra','Espectro','Kernel','Aurora','Vórtice','Delta'];
export const CATALOG=[];
for(let t=0;t<TYPES.length;t++){
 let exclusive=0;
 for(let c=0;c<CLASSES.length;c++)for(let n=0;n<COUNTS[c];n++){
  const recipe=c>3?exclusive++:n;
  const effect=EFFECTS[recipe%20],trigger=TRIGGERS[Math.floor(recipe/20)%11];
  CATALOG.push(Object.freeze({id:`${t}-${c}-${n}`,type:TYPES[t],classIndex:c,rarity:CLASSES[c],name:`${SCHOOLS[n%10]} ${EFFECT_NAMES[recipe%20]} ${Math.floor(n/10)+1} · ${CLASSES[c]}`,school:n%10,lore:`Forjado en el archivo ${SCHOOLS[n%10]}; su protocolo ${DELIVERIES[t].name} convierte ${TRIGGER_NAMES[Math.floor(recipe/20)%11]} en ${EFFECT_NAMES[recipe%20].toLowerCase()}.`,power:POWER[c],price:PRICES[c],level:Math.max(1,Math.floor((POWER[c]-1)*7)),effect,trigger,signature:`${TYPES[t]}:${trigger}:${effect}`,ability:`${EFFECT_NAMES[recipe%20]} ${TRIGGER_NAMES[Math.floor(recipe/20)%11]} · ${DELIVERIES[t].name}`,description:`${EFFECT_DETAILS[effect]} ${t===0&&trigger==='far'?'El impacto lejano prepara un corte durante 4 s; acércate a 3 casillas para liberarlo':DELIVERIES[t].description}.${trigger==='kill'?' Al vencer prepara esta habilidad para el próximo combate: se libera al perder vida cerca del rival.':''}`,geometry:t,cooldown:5+(n%4),exclusive:c>3}));
 }
}
export const BY_ID=Object.fromEntries(CATALOG.map(x=>[x.id,x]));
export const POOLS=CLASSES.map((_,i)=>CATALOG.filter(x=>x.classIndex===i));
export const DRAW_TABLES={100:[[0,90.5],[1,8.5],[2,.9],[3,.1]],1000:[[2,90],[3,9.5],[4,.25],[5,.25]],2500:[[3,90],[4,4.75],[5,4.75],[6,.5]],5000:[[4,45],[5,45],[6,9.5],[7,.25],[8,.25]],10000:[[6,92],[7,3.5],[8,3.5],[9,1]],25000:[[7,45],[8,45],[9,9.5],[10,.25],[11,.25]],50000:[[9,96.5],[10,1.5],[11,1.5],[12,.5]],100000:[[12,98],[13,1.6],[14,.2],[15,.2]]};
export function weighted(table,rng=Math.random){let roll=rng()*100;for(const [id,p]of table){roll-=p;if(roll<0)return id;}return table.at(-1)[0];}
export function randomItem(c,type=null,rng=Math.random){const pool=type?POOLS[c].filter(x=>x.type===type):POOLS[c];return pool[Math.floor(rng()*pool.length)];}
export function seeded(seed=12345){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
