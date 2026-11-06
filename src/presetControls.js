// Contextual hardware mappings.  The twelve DSP parameters are still present;
// only their physical presentation order changes from one preset family to another.
// A third page exposes *existing, working* Generator/Filter parameters.
import {systems,fromNorm,toNorm,format} from './parameters.js';
import {generativeDefaults,filterDefaults} from './generative/settings.js';
import {hierarchy} from './presetHierarchy.js';

const clamp01=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const spec=(label,min,max,unit='',curve='linear')=>({name:label,min,max,unit,curve});
const macros=[
 {id:'gen.density',name:'Частота событий',help:'Плотность генеративных возбуждений',spec:spec('Частота событий',.25,20,'/с','log')},
 {id:'gen.variation',name:'Вариативность',help:'Степень отклонений от фразы',spec:spec('Вариативность',0,1)},
 {id:'gen.response',name:'Отклик',help:'Скорость реакции на другие синтезаторы',spec:spec('Отклик',.02,2,'с','log')},
 {id:'gen.depth',name:'Влияние',help:'Глубина реакции на чужие события',spec:spec('Влияние',0,1)},
 {id:'filter.cutoff',name:'Срез фильтра',help:'Частота дополнительного фильтра',spec:spec('Срез фильтра',20,20000,'Hz','log')},
 {id:'filter.mix',name:'Смесь фильтра',help:'Баланс сухого/фильтрованного сигнала',spec:spec('Смесь фильтра',0,1)}
];

// The musical role takes precedence over the raw DSP class; e.g., bass samples
// using a drone engine need subharmonic controls first, not a generic noise layout.
function roleFor(preset,os){
 const genre=preset?.[3]?.genre||'',g=genre.toLowerCase(),analysis=preset?.[3]?.analysis;
 if(g.includes('psycore')&&!g.includes('slambient'))return 'psycore';
 if(g.includes('slambient')&&(g.includes('кик')||g.includes('kick')))return 'kick';
 if(g.includes('slambient')&&(g.includes('бас')||g.includes('bass')))return 'bass';
 if(g.includes('slambient')&&(g.includes('дрон')||g.includes('drone')))return 'drone';
 if(g.includes('slambient')&&(g.includes('текстур')||g.includes('texture')))return 'texture';
 if(analysis){
  if(g.includes('басов')||g.includes('кикбас'))return 'bass';
  if(g.includes('короткие удары')||g.includes('перкус'))return 'percussion';
  if(g.includes('атмосфер')||g.includes('дрон'))return 'drone';
  if(g.includes('тональные'))return 'tonal';
  if(g.includes('пульсации'))return 'pulse';
 }
 return ['bass','hard','rhythm'].includes(systems[os].dspType)?'psycore':systems[os].dspType==='ambient'?'drone':'texture';
}

// Priorities refer to REAL DSP parameters and are specialized for each engine.
// The first six become the expressive sound-design page, while the remaining
// six are always reachable on the second page.
const enginePriorities={
 0:[0,1,2,3,4,6],1:[1,2,3,4,7,6],2:[0,1,4,3,6,5],3:[0,4,5,6,7,3],
 4:[0,1,2,4,5,7],5:[0,1,2,3,4,6],6:[0,1,2,3,5,7],7:[0,1,2,4,6,7],
 8:[1,2,4,5,6,7],9:[0,1,2,3,5,6],10:[0,1,2,3,5,6],11:[0,1,2,4,5,6],
 12:[0,1,2,4,5,7],13:[0,7,2,3,4,1],14:[0,2,3,4,6,7],15:[0,2,3,5,6,7],
 16:[0,2,3,4,5,7],17:[0,2,3,4,6,7],18:[0,3,4,7,5,1],19:[1,2,4,5,6,7],
 20:[1,2,3,4,5,6],21:[0,1,2,4,5,7],22:[0,4,2,3,1,7],23:[0,1,2,3,4,7]
};
const roleOverride={
 // Bass material fed through Deep Drone: prioritize subharmonics, root and envelope.
 'bass:13':[0,7,4,2,3,1],
 'bass:21':[1,2,4,5,7,3],
 'bass:23':[0,1,2,4,7,5],
 'drone:22':[0,4,2,5,1,7],
 'percussion:23':[0,2,3,7,5,6],
 'percussion:18':[0,3,4,7,5,1],
 'pulse:21':[0,1,2,7,4,6],
 'kick:20':[1,2,3,5,6,4],
 'texture:19':[1,2,4,5,6,7],
 'tonal:22':[0,4,3,2,5,1]
};
// Every analyzed file may emphasize different aspects of a single engine.
// Move an appropriate measured dimension to the first page for unusual sounds.
function sourcePriorities(role,os,analysis,preferred){
 if(!analysis)return preferred;
 const selected=[...preferred];
 const promote=i=>{
  if(i===undefined||!Number.isInteger(i)||i<0||i>11)return;
  const at=selected.indexOf(i);if(at>=0)selected.splice(at,1);
  selected.unshift(i);
 };
 if(role==='percussion'){
  if(analysis.tailMs>2500)promote(os===2?1:os===23?2:4);
  if(analysis.highEnergy>.6)promote(os===2?3:os===23?3:7);
 }else if(role==='bass'){
  if(analysis.lowEnergy>.7)promote(os===21?1:os===13?7:1);
  if(analysis.events>60)promote(os===21?7:os===23?5:6);
 }else if(role==='drone'||role==='tonal'){
  if(analysis.tailMs>4000)promote(os===22?4:4);
  if(analysis.highEnergy>.35)promote(os===22?2:7);
 }else if(role==='pulse'&&analysis.events>80){
  promote(os===21?7:os===18?3:4);
 }
 return [...new Set([...selected,...preferred])].slice(0,6);
}
const aliases={
 'bass:21':{1:'Саб-основа',2:'Длина импульса',4:'Гармоники',5:'FM / фильтр',7:'Плотность баса',3:'Pitch-модуляция'},
 'bass:13':{0:'Основной тон',7:'Субгармоники',4:'Огибающая',2:'Гармоники',3:'Спектр',1:'Движение'},
 'percussion:2':{0:'Резонансный тон',1:'Затухание',4:'Частота ударов',3:'Яркость',6:'Атака',5:'Неравномерность'},
 'percussion:23':{0:'Ритм BPM',2:'Хвост барабана',3:'Щелчок / атака',7:'Ghost notes',5:'Нарезка',6:'Swing'},
 'drone:22':{0:'Тональная основа',4:'Время раскрытия',2:'Обертоны',5:'Расстройка',1:'Медленное движение',7:'Глубина'},
 'kick:20':{1:'Основной тон',2:'Длина кика',3:'Pitch dive',5:'Click',6:'Время свипа',4:'Тело'},
 'psycore:5':{0:'Темп',1:'Саб-основа',2:'Хвост кика',3:'Pitch dive',4:'Длительность баса',6:'Мутация'},
 'psycore:6':{0:'Темп',1:'Саб-основа',2:'Хвост кика',3:'Pitch dive',5:'FM индекс',7:'Фрагментация'},
 'psycore:12':{0:'Темп',1:'Саб-основа',2:'Хвост кика',4:'Rolling bass',5:'FM-окраска',7:'Мутация баса'}
};

export function controlPagesForPreset(preset,os){
 if(!Number.isInteger(os)||!systems[os])throw Error('Unknown engine: '+os);
 const role=roleFor(preset,os),base=roleOverride[role+':'+os]||enginePriorities[os]||[0,1,2,3,4,5];
 const preferred=sourcePriorities(role,os,preset?.[3]?.analysis,base);
 const ordered=[...new Set([...preferred,...Array.from({length:12},(_,i)=>i)])];
 const labelOverrides=aliases[role+':'+os]||{};
 const dsp=ordered.map(index=>({id:'dsp.'+index,type:'dsp',index,name:labelOverrides[index]||systems[os].params[index].name,help:systems[os].params[index].name,spec:systems[os].params[index]}));
 return {
  role,category:preset?hierarchy(preset):'Свой звук · '+systems[os].name,
  pages:[
   {name:'ЗВУК',description:'Главные параметры этого типа пресета',controls:dsp.slice(0,6)},
   {name:'ДЕТАЛИ',description:'Дополнительные параметры движка и эффекты',controls:dsp.slice(6,12)},
   {name:'ГЕНЕРАЦИЯ',description:'Связи пресетов и фильтр. * означает, что взаимодействие выключено',controls:macros.map(control=>({...control,type:control.id.startsWith('gen.')?'gen':'filter'}))}
  ]
 };
}

export function readControl(state,control){
 if(control.type==='dsp')return clamp01(state.params[control.index]);
 const [group,key]=control.id.split('.');
 const value=group==='gen'?(state.generative?.[key]??generativeDefaults[key]):(state.frequencyFilter?.[key]??filterDefaults[key]);
 return clamp01(toNorm(control.spec,value));
}
export function formatControl(state,control){return format(control.spec,readControl(state,control))}
export function controlInactive(state,control){
 if(control.type==='gen')return !state.generative||state.generative.source==='OFF';
 if(control.type==='filter')return !state.frequencyFilter||state.frequencyFilter.type==='OFF';
 return false;
}
export function writeControl(state,control,value){
 const n=clamp01(value);
 if(control.type==='dsp'){state.params[control.index]=n;return {type:'dsp',index:control.index,value:n}}
 const [group,key]=control.id.split('.');
 if(group==='gen'){
  state.generative={...generativeDefaults,...state.generative,[key]:fromNorm(control.spec,n)};
 }else if(group==='filter'){
  state.frequencyFilter={...filterDefaults,...state.frequencyFilter,[key]:fromNorm(control.spec,n)};
  // Turning a physical filter knob must be audible, not silently edit an OFF effect.
  if(state.frequencyFilter.type==='OFF')state.frequencyFilter.type='LP';
 }
 return {type:'extensions'};
}
