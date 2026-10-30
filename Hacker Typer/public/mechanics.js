// Mechanics shared by every item, including AI equipment. No item IDs are interpreted as code.
export const DELIVERIES=[
 {id:'slash',name:'corte',description:'requiere acercarse a 3 casillas; efecto inmediato'},
 {id:'projectile',name:'proyectil',description:'viaja a la casilla del rival; puede esquivarse antes de impactar'},
 {id:'counter',name:'contragolpe',description:'carga defensiva: se libera al recibir un golpe o al terminar su preparación'},
 {id:'reservoir',name:'reserva',description:'almacena energía y la libera cuando recibes daño o tras 2 segundos'},
 {id:'trail',name:'rastro',description:'deja un sello en tu posición; debes alejarte para activarlo'},
 {id:'field',name:'campo',description:'zona fija en el objetivo; debes mantenerlo dentro al resolverse'},
 {id:'orbit',name:'órbita',description:'dos pulsos separados; puedes reposicionarte entre ambos'}
];
export const EFFECT_DETAILS={
 heal:'Restaura vida sin superar el máximo.',ward:'Absorbe daño con una barrera consumible.',burn:'Inflige daño periódico durante 5 segundos.',slow:'Ralentiza el movimiento; en jefes retrasa el siguiente patrón.',nova:'Explosión de proximidad con empuje.',pierce:'Daño que ignora armadura.',leech:'Convierte parte del daño causado en vida.',haste:'Reduce la recarga pendiente de Dash, sin bajar de 3 s desde su uso.',focus:'Potencia el siguiente impacto directo y se consume.',frost:'Inmoviliza brevemente; los jefes solo retrasan su patrón.',reflect:'Devuelve parte del daño recibido, sin cadenas de reflejos.',stun:'Interrumpe una preparación; nunca suprime todos los ataques de un jefe.',regen:'Recupera vida gradualmente durante 6 segundos.',execute:'Marca al objetivo; el siguiente impacto bajo 25% de vida inflige daño adicional.',cleanse:'Elimina quemadura y ralentización; borra una zona peligrosa cercana.',reach:'Amplía el alcance durante 6 segundos.',armor:'Mitiga temporalmente el daño; nunca concede invulnerabilidad.',charge:'Reduce la recarga pendiente de técnica y especial.',echo:'Repite el último impacto directo con menor potencia después de un retraso.',vortex:'Atrae al rival una casilla; no mueve a jefes anclados.'
};
export const SCHOOLS=['Vector','Nexo','Prisma','Órbita','Cifra','Espectro','Kernel','Aurora','Vórtice','Delta'];
export const SYNERGIES=[
 {id:'vector-duel',name:'Duelo vectorial',types:['espadas','escudos'],school:0,trigger:'block',effect:'focus'},
 {id:'nexo-sustain',name:'Circuito vital',types:['armaduras','especiales'],school:1,trigger:'low',effect:'regen'},
 {id:'prisma-beam',name:'Prisma refractado',types:['pistolas','tecnicas'],school:2,trigger:'far',effect:'pierce'},
 {id:'orbit-step',name:'Órbita evasiva',types:['ropa','especiales'],school:3,trigger:'dash',effect:'ward'},
 {id:'cifra-return',name:'Respuesta cifrada',types:['escudos','armaduras'],school:4,trigger:'block',effect:'reflect'},
 {id:'spectre-edge',name:'Filo espectral',types:['espadas','ropa'],school:5,trigger:'dash',effect:'reach'},
 {id:'kernel-loop',name:'Bucle del núcleo',types:['tecnicas','armaduras'],school:6,trigger:'combo',effect:'charge'},
 {id:'aurora-reset',name:'Restauración aurora',types:['ropa','escudos'],school:7,trigger:'hurt',effect:'cleanse'},
 {id:'vortex-collapse',name:'Colapso del vórtice',types:['tecnicas','especiales'],school:8,trigger:'act',effect:'vortex'},
 {id:'delta-conduit',name:'Conducto delta',types:['pistolas','ropa'],school:9,trigger:'far',effect:'slow'},
 {id:'vector-rupture',name:'Ruptura vectorial',types:['espadas','tecnicas'],school:0,trigger:'combo',effect:'nova'},
 {id:'nexo-horizon',name:'Horizonte del nexo',types:['pistolas','especiales'],school:1,trigger:'act',effect:'echo'}
];
export function activeSynergies(items){return SYNERGIES.filter(s=>s.types.every(t=>items.some(i=>i.type===t&&i.school===s.school)));}
export const COMBOS=[
 {id:'rupture',name:'Ruptura',sequence:['atq','atq','dash','act'],effect:'rupture'},
 {id:'riposte',name:'Respuesta',sequence:['def','atq','act'],effect:'riposte'},
 {id:'escape',name:'Paso fantasma',sequence:['dash','def','act'],effect:'escape'},
 {id:'cascade',name:'Cascada',sequence:['act','atq','act'],effect:'cascade'},
 {id:'breach',name:'Brecha',sequence:['atq','def','atq'],effect:'breach'}
];
export function effectDescription(item){return `${DELIVERIES[item.geometry].name}: ${EFFECT_DETAILS[item.effect]} ${DELIVERIES[item.geometry].description}.`}

export function campaign(s){return[
 {name:'I · Arranque',text:'La terminal despierta. Completa tus primeras 100 teclas y abre la paleta.',done:s.keys>=100},
 {name:'II · Perímetro',text:'Vence un Firewall y aprende a salir de los avisos antes del impacto.',done:s.stats.firewall>=1},
 {name:'III · Rivales',text:'Vence cinco bots, prueba las piezas obtenidas y arma una combinación.',done:s.stats.bots>=5},
 {name:'IV · Arquitectura',text:'Descubre 25 objetos. Activa una sinergia y domina un combo.',done:Object.keys(s.inventory).length>=25&&s.stats.combo>=1},
 {name:'V · Señal oculta',text:s.hintSeen?'La señal del Firewall difícil fue revelada. Su primera victoria mostró la pista.':'Vence el Firewall difícil para descubrir qué protege.',done:s.stats.hard>=1},
 {name:s.stats.white?'VI · Horizonte blanco':'VI · Sector desconocido',text:s.stats.white?'Has atravesado el horizonte. El núcleo oscuro aún responde.':'Sigue la señal del sistema; no todos sus comandos están documentados.',done:(s.stats.white||0)>=1},
 {name:s.stats.dark?'VII · Infinite System':'VII · Núcleo desconocido',text:s.stats.dark?'Has completado el arco principal. Continúa con equipos, logros y desafíos.':'El último sector conserva una segunda amenaza.',done:(s.stats.dark||0)>=1}
];}
