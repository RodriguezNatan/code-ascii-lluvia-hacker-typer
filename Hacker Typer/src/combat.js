import {BY_ID,TYPES,POWER,randomItem,seeded,EFFECTS} from './catalog.js';
import {COMBOS,activeSynergies} from './mechanics.js';
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function stats(s){
 const power=t=>{const i=BY_ID[s.equipped[t]];return i.power*(1+s.inventory[i.id].upgrade*.07);};
 const items=TYPES.map(t=>({...BY_ID[s.equipped[t]],power:power(t)}));
 const same=items.filter(i=>i.classIndex===items[0].classIndex).length;
 return {items,maxHP:120+s.level*6+power('armaduras')*15,armor:Math.min(.6,power('armaduras')*.055+power('ropa')*.02),sword:12+power('espadas')*8+s.level*.6,gun:8+power('pistolas')*6+s.level*.4,unarmed:5+s.level*.35,dashCD:Math.max(3,10-power('ropa')*.7),synergy:same>=3?1.1:1,links:activeSynergies(items)};
}
export function botEquipment(s,d,rng=Math.random){
 const avg=TYPES.reduce((n,t)=>n+BY_ID[s.equipped[t]].power,0)/7,target=Math.max(1,avg+[-.6,0,.8][d]);let c=0;
 for(let i=0;i<POWER.length;i++)if(POWER[i]<=target)c=i;
 if(s.level<25)c=Math.min(c,11);else if(s.level<35)c=Math.min(c,13);
 const items=TYPES.map(t=>randomItem(c,t,rng));
 // Higher difficulties can deliberately form an actual two-piece synergy.
 if(d>0){const link=activeSynergies(items)[0];if(!link){const a=items[0],n=Number(a.id.split('-')[2]);items[2]=BY_ID[`2-${c}-${Math.floor(n/10)*10}`]||items[2];items[0]=BY_ID[`0-${c}-${Math.floor(n/10)*10}`]||a;}}
 const upgrade=clamp(Math.round(TYPES.reduce((n,t)=>n+s.inventory[s.equipped[t]].upgrade,0)/7)+[-1,0,1][d],0,10);return items.map(i=>({...i,upgrade}));
}
function actor(x,y,s){return{x,y,hp:s.maxHP,maxHP:s.maxHP,stats:s,slot:1,cd:{attack:0,dash:0,shield:0,tech:0,special:0,move:0},status:{},effectCD:{},combo:[],blockUntil:0,dashUntil:0,lastDash:-100,lastDamage:0,ward:0,usedDash:0,combos:0,commandUse:{atq:0,def:0,dash:0,act:0}};}
export class Combat{
 constructor(s,kind='firewall',difficulty=0,rng=Math.random){
  this.kind=kind;this.difficulty=difficulty;this.rng=rng;this.seed=Math.floor(rng()*4294967296);this.random=seeded(this.seed);this.rolls=0;
  this.id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${this.seed}`;
  this.loadout={level:s.level,equipped:{...s.equipped},inventory:Object.fromEntries(TYPES.map(t=>[s.equipped[t],{...s.inventory[s.equipped[t]]}]))};
  this.stats=stats(s);this.player=actor(2,6,this.stats);this.loot=kind==='bot'?botEquipment(s,difficulty,()=>this.roll()):[];
  const bs={level:clamp(s.level+[-3,0,3][difficulty],1,100),equipped:{},inventory:{}};
  (this.loot.length?this.loot:TYPES.map((t,i)=>BY_ID[`${i}-0-0`])).forEach(i=>{bs.equipped[i.type]=i.id;bs.inventory[i.id]={count:1,upgrade:i.upgrade||0};});
  const es=stats(bs),bp=this.loot.reduce((n,i)=>n+i.power,0)/7||1;
  const hp=kind==='white'?3800:kind==='dark'?7000:kind==='training'?5000:kind==='bot'?Math.round(es.maxHP*(.85+difficulty*.12)):[260,750,1600][difficulty];
  this.enemy=actor(9,4,{...es,maxHP:hp});this.enemyArmor=kind==='bot'?es.armor:0;
  this.time=0;this.hazards=[];this.queue=[];this.visuals=[];this.events=[];this.log=['Zonas rayadas: aviso. Flechas para salir antes del impacto.'];this.done=false;this.victory=false;this.paused=false;this.practice=false;this.patternCount=0;this.nextPattern=1.8;this.nextMove=1;this.nextThink=1;this.botPlan=[];this.reactions=[];this.focusTarget=null;
  this.damageScale=kind==='dark'?40:kind==='white'?28:10+difficulty*7;this.legacy=[];this.metrics={playerDamage:0,enemyDamage:0,blocked:0,avoided:0,effects:0,botActions:0};
  this.inherited=(s.legacy||[]).filter(id=>this.stats.items.some(i=>i.id===id&&i.trigger==='kill')); 
 }
 get cd(){return this.player.cd;}get status(){return this.player.status;}get effectCD(){return this.player.effectCD;}get slot(){return this.player.slot;}set slot(v){this.player.slot=v;}get combo(){return this.player.combo;}set combo(v){this.player.combo=v;}get blockUntil(){return this.player.blockUntil;}set blockUntil(v){this.player.blockUntil=v;}get dashUntil(){return this.player.dashUntil;}set dashUntil(v){this.player.dashUntil=v;}get usedDash(){return this.player.usedDash;}get combos(){return this.player.combos;}get commandUse(){return this.player.commandUse;}
 roll(){this.rolls++;return this.random();}
 other(a){return a===this.player?this.enemy:this.player;}side(a){return a===this.player?'player':'enemy';}
 note(t){this.log.push(t);if(this.log.length>5)this.log.shift();}
 visual(kind,a,b=a){this.visuals.push({kind,x:a.x,y:a.y,tx:b.x,ty:b.y,start:this.time,end:this.time+.5,side:this.side(a)});this.events.push(kind);if(this.events.length>20)this.events.shift();}
 move(dx,dy,a=this.player){if(this.done||this.paused||Math.abs(dx)+Math.abs(dy)!==1||a.cd.move>this.time||a.status.root>this.time||a.status.stun>this.time)return false;const x=clamp(a.x+dx,0,11),y=clamp(a.y+dy,0,8);if(x===a.x&&y===a.y)return false;a.x=x;a.y=y;a.cd.move=this.time+(a.status.slow>this.time?.22:.105);return true;}
 heal(n,a=this.player){a.hp=Math.min(a.maxHP,a.hp+Math.max(0,n));}
 damage(n,flags={}){this.receive(this.enemy,n,this.player,flags);}
 hurt(n,flags={}){this.receive(this.player,n,this.enemy,flags);}
 hit(a,n,flags={}){if(a===this.player)this.damage(n,flags);else this.hurt(n,flags);}
 receive(a,n,attacker,flags={}){
  if(this.done||n<=0||!Number.isFinite(n))return;
  if(a.dashUntil>this.time){if(a===this.player)this.metrics.avoided++;return;}
  const blocked=a.blockUntil>this.time;if(blocked){n*=.18;if(a===this.player)this.metrics.blocked++;}
  if(!flags.pierce){n*=1-(a===this.player?a.stats.armor:this.enemyArmor);if(a.status.armor>this.time)n*=.65;}
  const absorbed=Math.min(n,a.ward);a.ward-=absorbed;n-=absorbed;const actual=Math.min(a.hp,n);a.hp=Math.max(0,a.hp-n);
  this.metrics[a===this.player?'enemyDamage':'playerDamage']+=actual;
  this.visual(blocked?'block':'hurt',a);
  if(!flags.reflected&&a.status.reflect>this.time)this.hit(a,actual*.35,{reflected:true});
  if(a.hp>0){if(blocked)this.fire('block',a);this.fire('hurt',a);if(a.hp<a.maxHP*.3)this.fire('low',a);for(const q of this.queue)if(q.side===this.side(a)&&['counter','reservoir'].includes(q.delivery))q.at=Math.min(q.at,this.time+.05);}
  if(a.hp<=0){this.done=true;this.victory=a===this.enemy;if(this.victory)this.legacy=this.stats.items.filter(i=>i.trigger==='kill').map(i=>i.id);this.fire('kill',attacker);}
 }
 fire(trigger,a=this.player){
  if(a===this.enemy&&!['bot','training'].includes(this.kind))return;
  for(const item of a.stats.items){if(item.trigger!==trigger||(a.effectCD[item.id]||0)>this.time)continue;a.effectCD[item.id]=this.time+item.cooldown;if(trigger==='kill')continue;this.deliver(a,item);}
  for(const link of a.stats.links||[]){if(link.trigger!==trigger||(a.effectCD[link.id]||0)>this.time)continue;a.effectCD[link.id]=this.time+12;this.applyEffect(a,{effect:link.effect,power:2,geometry:6},1);this.note(`${a===this.player?'Sinergia':'IA'}: ${link.name}`);}
 }
 effect(item){this.deliver(this.player,item);}
 deliver(a,item){
  const target=this.other(a),d=distance(a,target),side=this.side(a),base={side,itemId:item.id,effect:item.effect,power:item.power,origin:{x:a.x,y:a.y},target:{x:target.x,y:target.y},expires:this.time+4};
  // Ordinary equipment retains simple introductory effects. Superior items use spatial delivery.
  if(!item.exclusive){this.applyEffect(a,item,1);return;}
  const push=(delivery,delay,scale=1)=>this.queue.push({...base,delivery,at:this.time+delay,scale});
  switch(item.geometry){
   case 0:if(d<=3){this.visual('slash',a,target);this.applyEffect(a,item,1);}else if(item.trigger==='far')push('preparedSlash',.05);break;
   case 1:if(d<=9){push('projectile',Math.max(.2,d*.07));this.visual('projectile',a,target);}break;
   case 2:push('counter',.9);a.ward=Math.min(a.maxHP*.3,a.ward+item.power);break;
   case 3:push('reservoir',2);break;
   case 4:push('trail',.25);break;
   case 5:push('field',1);break;
   case 6:push('orbit',.4,.55);push('orbit',1.4,.55);break;
  }
 }
 applyEffect(a,item,scale=1){
  if(this.done)return;const b=this.other(a),p=item.power*scale,d=distance(a,b),self=(k,t)=>a.status[k]=Math.max(a.status[k]||0,this.time+t),foe=(k,t)=>b.status[k]=Math.max(b.status[k]||0,this.time+t),near=d<=7;
  this.metrics.effects++;this.visual('effect',a,b);
  switch(item.effect){
   case'heal':this.heal(p*3,a);break;
   case'ward':a.ward=Math.min(a.maxHP*.3,a.ward+p*7);break;
   case'burn':if(near){foe('burn',5);b.status.burnPower=Math.max(b.status.burnPower||0,p*1.5);}break;
   case'slow':if(near){foe('slow',4);if(a===this.player&&!['bot','training'].includes(this.kind))this.nextPattern=Math.max(this.nextPattern,this.time+1.3);}break;
   case'nova':if(d<=3){this.hit(a,p*4);this.push(b,a,-1);}break;
   case'pierce':if(near)this.hit(a,p*5,{pierce:true});break;
   case'leech':if(near){const before=b.hp;this.hit(a,p*3);this.heal((before-b.hp)*.65,a);}break;
   case'haste':if(a.cd.dash>this.time)a.cd.dash=Math.max(a.lastDash+3,this.time,a.cd.dash-1.5);break;
   case'focus':self('focus',6);break;
   case'frost':if(near){if(a===this.player&&!['bot','training'].includes(this.kind))this.nextPattern=Math.max(this.nextPattern,this.time+.8);else foe('root',.8);}break;
   case'reflect':self('reflect',4);break;
   case'stun':if(near){foe('stun',.6);for(const h of this.hazards)if(this.time<h.at)h.at=Math.max(h.at,this.time+.65);this.nextThink=Math.max(this.nextThink,this.time+.6);}break;
   case'regen':self('regen',6);a.status.regenPower=p*.8;break;
   case'execute':if(near){foe('marked',8);b.status.markPower=p*5;}break;
   case'cleanse':a.status.burn=0;a.status.slow=0;a.status.root=0;this.hazards=this.hazards.filter(h=>!h.cells.some(c=>distance(c,a)<=1));break;
   case'reach':self('reach',6);break;
   case'armor':self('armor',4);break;
   case'charge':a.cd.tech=Math.max(this.time,a.cd.tech-2);a.cd.special=Math.max(this.time,a.cd.special-2);break;
   case'echo':if(a.lastDamage>0)this.queue.push({side:this.side(a),delivery:'echo',at:this.time+.6,expires:this.time+1,target:{x:b.x,y:b.y},damage:a.lastDamage*.35});break;
   case'vortex':if(near)this.push(b,a,1);break;
  }
 }
 push(b,a,dir){if(b===this.enemy&&!['bot','training'].includes(this.kind))return;const dx=Math.sign(a.x-b.x)*dir,dy=Math.sign(a.y-b.y)*dir;if(Math.abs(a.x-b.x)>=Math.abs(a.y-b.y))b.x=clamp(b.x+dx,0,11);else b.y=clamp(b.y+dy,0,8);}
 action(cmd){return this.actorAction(this.player,cmd);}
 actorAction(a,cmd){
  if(this.done||this.paused||a.status.stun>this.time)return false;const b=this.other(a),d=distance(a,b),reach=a.status.reach>this.time?2:0;let executed=false;
  const attack=(amount,range)=>{if(d>range){if(a===this.player)this.note('Fuera de alcance');return;}const multiplier=a.stats.synergy*(a.status.focus>this.time?1.3:1);a.status.focus=0;const n=amount*multiplier;a.lastDamage=n;this.hit(a,n);if(b.status.marked>this.time&&b.hp<b.maxHP*.25){b.status.marked=0;this.hit(a,b.status.markPower||0);}this.visual(a.slot===2?'projectile':'slash',a,b);this.fire('hit',a);this.fire(d>3?'far':'near',a);};
  if(cmd==='dash'&&a.cd.dash<=this.time){a.dashUntil=this.time+.45;a.lastDash=this.time;a.cd.dash=this.time+a.stats.dashCD;a.usedDash++;this.fire('dash',a);this.visual('dash',a);executed=true;}
  if(cmd==='def'&&a.cd.shield<=this.time){a.blockUntil=this.time+1.2;a.cd.shield=this.time+4;this.visual('block',a);executed=true;}
  if(cmd==='atq'&&a.cd.attack<=this.time){a.cd.attack=this.time+.45;attack(a.slot===1?a.stats.sword:a.slot===2?a.stats.gun:a.stats.unarmed,(a.slot===2?7:1)+reach);executed=true;}
  if(cmd==='act'){
   if(a.slot<=2&&a.cd.tech<=this.time){a.cd.tech=this.time+3;attack(a.slot===1?a.stats.sword*1.5:a.stats.gun*1.8,(a.slot===1?3:9)+reach);executed=true;}
   if(a.slot===3&&a.cd.shield<=this.time){a.blockUntil=this.time+2;a.cd.shield=this.time+5;executed=true;}
   if(a.slot===4&&a.cd.tech<=this.time){a.cd.tech=this.time+5;const item=a.stats.items.find(i=>i.type==='tecnicas');this.deliver(a,item);attack(18+item.power*8,5);executed=true;}
   if(a.slot===5&&a.cd.special<=this.time){a.cd.special=this.time+12;const item=a.stats.items.find(i=>i.type==='especiales');this.deliver(a,item);attack(30+item.power*12,7);executed=true;}
   if(executed)this.fire('act',a);
  }
  if(executed){a.commandUse[cmd]=(a.commandUse[cmd]||0)+1;a.combo.push({cmd,time:this.time});a.combo=a.combo.slice(-4);for(const combo of COMBOS){const tail=a.combo.slice(-combo.sequence.length);if(tail.length===combo.sequence.length&&tail.map(x=>x.cmd).join(' ')===combo.sequence.join(' ')&&this.time-tail[0].time<6){a.combos++;this.fire('combo',a);this.comboEffect(a,combo.effect);a.combo=[];this.visual('combo',a,b);this.note(`${a===this.player?'COMBO':'IA COMBO'}: ${combo.name}`);break;}}
  }
  return executed;
 }
 comboEffect(a,kind){const b=this.other(a),d=distance(a,b);switch(kind){case'rupture':if(d<=7)this.hit(a,a.stats.sword*.8);this.heal(8,a);break;case'riposte':a.status.focus=this.time+5;a.ward+=8;break;case'escape':a.status.reach=this.time+5;this.heal(5,a);break;case'cascade':a.cd.special=Math.max(this.time,a.cd.special-3);break;case'breach':if(d<=7)this.hit(a,a.stats.unarmed*2,{pierce:true});break;}}
 pattern(){
  this.patternCount++;const cells=[],p=this.player;const add=(x,y)=>{if(x>=0&&x<12&&y>=0&&y<9&&!cells.some(c=>c.x===x&&c.y===y))cells.push({x,y});};let label='Pulso';
  if(this.kind==='dark'&&this.patternCount%3===0){for(let i=-2;i<=2;i++)add(p.x+i,p.y);label='Llamas negras';}
  else if(this.kind==='dark'){const w=this.roll()<.5?2:3;for(let x=0;x<w;x++)for(let y=0;y<2;y++)add(Math.min(12-w,p.x)+x,Math.min(7,p.y)+y);label='Agujero negro';}
  else if(this.kind==='white'){for(let i=-2;i<=2;i++){add(p.x+i,p.y);add(p.x,p.y+i);}label='Estrella de neutrones';}
  else if(this.roll()<.5)for(let x=0;x<12;x++)add(x,p.y);else for(let y=0;y<9;y++)add(p.x,y);
  this.hazards.push({cells,at:this.time+(this.difficulty===2?.95:1.3),end:0,hit:false,label});this.visual('warning',p);
 }
 think(){
  const a=this.enemy,b=this.player,d=distance(a,b),hard=this.difficulty===2;
  if(a.status.stun>this.time)return;
  // A reaction is to an observed attack warning, never to future input.
  const threat=this.queue.some(q=>q.side==='player'&&q.target&&distance(q.target,a)<=1&&q.at-this.time<.6);
  if(threat&&this.difficulty>0){this.actorAction(a,'dash');this.move(a.x>5?-1:1,0,a);}
  const desired=a.hp<a.maxHP*.35?5:this.player.commandUse.def>this.player.commandUse.dash?6:3;
  if(d<desired&&hard)this.move(Math.sign(a.x-b.x)||1,0,a);else if(d>desired){if(Math.abs(b.x-a.x)>Math.abs(b.y-a.y))this.move(Math.sign(b.x-a.x),0,a);else this.move(0,Math.sign(b.y-a.y),a);}
  if(this.botPlan.length){const step=this.botPlan.shift();a.slot=step.slot;this.reactions.push({at:this.time+(hard?.38:this.difficulty?.6:.9),cmd:step.cmd,slot:step.slot});return;}
  if(hard&&this.roll()<.35){this.botPlan=[{cmd:'def',slot:3},{cmd:'atq',slot:d<=1?1:2},{cmd:'act',slot:4}];return;}
  let cmd='atq',slot=d<=1?1:2;
  if(a.hp<a.maxHP*.6&&a.cd.special<=this.time){slot=5;cmd='act';}else if(a.cd.tech<=this.time){slot=this.difficulty>0&&this.roll()<.5?4:slot;cmd='act';}else if(this.roll()<.18&&a.cd.shield<=this.time){slot=3;cmd='def';}
  this.reactions.push({at:this.time+(hard?.38:this.difficulty?.6:.9),cmd,slot});this.note(`IA prepara ${['','espada','disparo','bloqueo','técnica','especial'][slot]}`);
 }
 tick(dt){
  if(this.done||this.paused)return;dt=clamp(dt,0,.05);this.time+=dt;
  if(this.player.hp<this.player.maxHP&&distance(this.player,this.enemy)<=2&&this.inherited.length){for(const id of this.inherited)this.deliver(this.player,this.stats.items.find(i=>i.id===id));this.inherited=[];}
  for(const a of[this.player,...(this.kind==='bot'||this.practice?[this.enemy]:[])]){this.fire('period',a);if(a.status.regen>this.time)this.heal(dt*(a.status.regenPower||3),a);if(a.status.burn>this.time){if(a===this.player)this.hurt(dt*(a.status.burnPower||6),{dot:true});else this.damage(dt*(a.status.burnPower||6),{dot:true});}}
  if(!['bot','training'].includes(this.kind)&&this.enemy.status.burn>this.time)this.damage(dt*(this.enemy.status.burnPower||6),{dot:true});
  if(!['bot','training'].includes(this.kind)&&this.time>=this.nextPattern){this.pattern();this.nextPattern=this.time+(this.kind==='dark'?2.3:this.kind==='white'?2.5:3.2-this.difficulty*.35);}
  if((this.kind==='bot'||this.kind==='training'&&this.practice)&&this.time>=this.nextThink){this.think();this.nextThink=this.time+[1.2,.85,.6][this.difficulty];}
  for(const r of this.reactions.filter(r=>r.at<=this.time)){this.enemy.slot=r.slot;if(this.actorAction(this.enemy,r.cmd))this.metrics.botActions++;}this.reactions=this.reactions.filter(r=>r.at>this.time);
  const pending=this.queue;this.queue=[];
  for(const q of pending){if(q.expires<this.time)continue;const a=this[q.side],b=this.other(a);if(q.at>this.time){this.queue.push(q);continue;}
   if(q.delivery==='trail'&&distance(a,q.origin)<2){this.queue.push(q);continue;}
   if(q.delivery==='preparedSlash'&&distance(a,b)>3){this.queue.push(q);continue;}
   if(q.delivery==='projectile'&&distance(b,q.target)>0)continue;
   if(q.delivery==='field'&&distance(b,q.target)>1)continue;
   if(q.delivery==='orbit'&&distance(a,b)>7)continue;
   if(q.delivery==='counter'&&distance(a,b)>2)continue;
   if(q.delivery==='echo'){if(distance(b,q.target)<=1)this.hit(a,q.damage);continue;}
   this.applyEffect(a,{effect:q.effect,power:q.power},q.scale);
  }
  for(const h of this.hazards){if(this.time>=h.at){if(!h.end)h.end=h.at+.7;if(!h.hit&&h.cells.some(c=>c.x===this.player.x&&c.y===this.player.y)){h.hit=true;this.hurt(this.damageScale);}}}this.hazards=this.hazards.filter(h=>!h.end||h.end>this.time);this.visuals=this.visuals.filter(v=>v.end>this.time);
 }
 snapshot(){const fields=['id','seed','rolls','kind','difficulty','loadout','time','hazards','queue','log','done','victory','practice','patternCount','nextPattern','nextThink','botPlan','reactions','legacy','inherited','metrics'];const data=Object.fromEntries(fields.map(k=>[k,structuredClone(this[k])]));data.loot=this.loot.map(i=>i.id);data.lootUpgrades=this.loot.map(i=>i.upgrade||0);for(const side of['player','enemy']){data[side]=structuredClone(this[side]);delete data[side].stats;}return{version:1,data};}
 static restore(snapshot){validateBattle(snapshot);const d=snapshot.data,b=new Combat(d.loadout,d.kind,d.difficulty,()=>.5);b.loot=d.loot.map((id,i)=>({...BY_ID[id],upgrade:d.lootUpgrades[i]}));if(b.loot.length){const s={level:clamp(d.loadout.level+[-3,0,3][d.difficulty],1,100),equipped:{},inventory:{}};for(const i of b.loot){s.equipped[i.type]=i.id;s.inventory[i.id]={count:1,upgrade:i.upgrade};}b.enemy.stats=stats(s);b.enemyArmor=b.enemy.stats.armor;}
  for(const[k,v]of Object.entries(d))if(!['player','enemy','loot'].includes(k))b[k]=structuredClone(v);
  for(const side of['player','enemy'])Object.assign(b[side],structuredClone(d[side]));b.random=seeded(d.seed);for(let i=0;i<d.rolls;i++)b.random();b.stats=b.player.stats;return b;
 }
}
export function validateBattle(s){
 if(!s||s.version!==1||!s.data)throw Error('Combate guardado inválido');const d=s.data;d.lootUpgrades??=(d.loot||[]).map(()=>0);
 const allowed=new Set(['id','seed','rolls','kind','difficulty','loadout','time','hazards','queue','log','done','victory','practice','patternCount','nextPattern','nextThink','botPlan','reactions','legacy','inherited','metrics','loot','lootUpgrades','player','enemy']);
 if(Object.keys(d).some(k=>!allowed.has(k))||!['bot','firewall','white','dark','training'].includes(d.kind)||![0,1,2].includes(d.difficulty)||typeof d.id!=='string'||d.id.length>100||!Number.isInteger(d.rolls)||d.rolls<0||d.rolls>100000)throw Error('Estado de arena inválido');
 function walk(v,depth=0){if(depth>10)throw Error('Estado demasiado profundo');if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>4294967296))throw Error('Número inválido');if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(['__proto__','prototype','constructor','stats'].includes(k))throw Error('Campo no permitido');walk(x,depth+1);}}
 walk(d);if(JSON.stringify(s).length>200000)throw Error('Arena demasiado grande');
 for(const side of['player','enemy']){const a=d[side];if(!a||!Number.isInteger(a.x)||!Number.isInteger(a.y)||a.x<0||a.x>11||a.y<0||a.y>8||a.hp<0||a.hp>a.maxHP||!a.status||!a.cd)throw Error('Actor inválido');}
 if(!d.loadout||!Number.isInteger(d.loadout.level)||d.loadout.level<1||d.loadout.level>100)throw Error('Equipo de arena inválido');
 for(const t of TYPES){const id=d.loadout.equipped?.[t],v=d.loadout.inventory?.[id];if(!BY_ID[id]||BY_ID[id].type!==t||!v||!Number.isInteger(v.upgrade)||v.upgrade<0||v.upgrade>10)throw Error('Objeto de arena inválido');}
 if(!Array.isArray(d.loot)||d.loot.some(id=>!BY_ID[id])||!Array.isArray(d.queue)||!Array.isArray(d.hazards)||!Array.isArray(d.reactions)||!Array.isArray(d.log)||d.log.some(v=>typeof v!=='string'))throw Error('Contenido de arena inválido');
 const number=(v,max=1e7)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 const cell=v=>v&&Number.isInteger(v.x)&&Number.isInteger(v.y)&&v.x>=0&&v.x<12&&v.y>=0&&v.y<9;
 if(!d.metrics||['playerDamage','enemyDamage','blocked','avoided','effects','botActions'].some(k=>!number(d.metrics[k])))throw Error('Métricas incompletas');
 if(!number(d.time,86400)||!number(d.seed,4294967295)||!Number.isInteger(d.seed)||!number(d.nextPattern)||!number(d.nextThink)||!Number.isInteger(d.patternCount)||d.patternCount<0||['done','victory','practice'].some(k=>typeof d[k]!=='boolean')||!d.metrics||Object.values(d.metrics).some(v=>!number(v)))throw Error('Tiempo o métricas inválidos');
 for(const key of['legacy','inherited'])if(!Array.isArray(d[key])||d[key].length>7||d[key].some(id=>!BY_ID[id]))throw Error('Preparación inválida');
 if(!Array.isArray(d.lootUpgrades)||d.lootUpgrades.length!==d.loot.length||d.lootUpgrades.some(n=>!Number.isInteger(n)||n<0||n>10))throw Error('Mejora de bot inválida');
 if(d.kind==='bot'&&(d.loot.length!==7||new Set(d.loot.map(id=>BY_ID[id].type)).size!==7))throw Error('Equipo del bot incompleto');
 for(const side of['player','enemy']){const a=d[side];if(!number(a.hp)||!number(a.maxHP)||a.maxHP<=0||!number(a.ward)||!Number.isInteger(a.slot)||a.slot<1||a.slot>6||!Array.isArray(a.combo)||a.combo.length>4||a.combo.some(x=>!['atq','act','dash','def'].includes(x.cmd)||!number(x.time))||Object.values(a.status).some(x=>!number(x))||Object.values(a.cd).some(x=>!number(x))||!a.effectCD||Object.values(a.effectCD).some(x=>!number(x)))throw Error('Acciones de actor inválidas');}
 for(const side of['player','enemy']){const a=d[side];if(['attack','dash','shield','tech','special','move'].some(k=>!number(a.cd[k]))||!a.commandUse||['atq','act','dash','def'].some(k=>!number(a.commandUse[k]))||['usedDash','combos','lastDamage','blockUntil','dashUntil'].some(k=>!number(a[k]))||!Number.isFinite(a.lastDash))throw Error('Actor incompleto');}
 if(d.queue.length>100||d.queue.some(q=>!['player','enemy'].includes(q.side)||!['projectile','counter','reservoir','trail','field','orbit','echo','preparedSlash'].includes(q.delivery)||!number(q.at)||!number(q.expires)||!cell(q.target)||(q.delivery==='echo'?!number(q.damage):!EFFECTS.includes(q.effect)||!number(q.power,100)||!cell(q.origin)||!number(q.scale,2))))throw Error('Efecto pendiente inválido');
 if(d.hazards.length>20||d.hazards.some(h=>!Array.isArray(h.cells)||h.cells.length>108||h.cells.some(c=>!cell(c))||!number(h.at)||!number(h.end)||typeof h.hit!=='boolean'||typeof h.label!=='string'))throw Error('Patrón inválido');
 const action=r=>r&&['atq','act','dash','def'].includes(r.cmd)&&Number.isInteger(r.slot)&&r.slot>=1&&r.slot<=5;
 if(!Array.isArray(d.botPlan)||d.botPlan.length>10||d.botPlan.some(r=>!action(r))||d.reactions.length>20||d.reactions.some(r=>!action(r)||!number(r.at)))throw Error('Plan de IA inválido');
}

