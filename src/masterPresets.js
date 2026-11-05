import {synthPresets} from './presets.js';
import {defaults,midiDefaults,engineRegistry} from './parameters.js';
import {MidiAutoRouter,analyzeTrack,compatibility} from './midi/MidiAutoRouter.js';
import {extensionDefaults} from './generative/settings.js';

// Each scene replaces the synth tabs and binds coherent per-role audio/MIDI
// followers. Seed/params remain reproducible; project JSON stays at v4.
const layer=(preset,volume,character,depth,response,density,variation,filter=null)=>({preset,volume,character,depth,response,density,variation,filter});
export const masterPresets=[
 {id:'slambient-ritual',name:'Slambient · Ritual Geometry',genre:'Psycore / Slambient',bpm:186,description:'Кик и rolling bass отдельно от тональных темных слоёв; тягучая психоделическая фактура без сплошного шума.',layers:[
  layer('Slambient / Short Slam',.28,'PULSE',.38,.09,5,.16),
  layer('Slambient / Low Chugs',.28,'PULSE',.44,.11,9,.24),
  layer('Slambient · Stone harmonics',.25,'DRONE',.46,.8,.4,.22,{type:'LP',cutoff:3500,q:.7,mix:.85}),
  layer('Slambient / Metal Shrine',.15,'TEXTURE',.3,.7,.65,.24,{type:'LP',cutoff:1900,q:.7,mix:.8})]},
 {id:'slambient-organic',name:'Slambient · Living Cavern',genre:'Psycore / Slambient',bpm:202,description:'Органические спектральные удары, медленный хор и циклический бас; умеренная плотность возбуждений.',layers:[
  layer('Slambient / Deep Impact',.24,'PULSE',.35,.08,5,.2),
  layer('Slambient / Mutating Root',.23,'PULSE',.5,.1,8,.35),
  layer('Slambient · Subterranean choir',.27,'DRONE',.52,1.1,.35,.28,{type:'LP',cutoff:4800,q:.8,mix:.7}),
  layer('Slambient / Breathing Void',.16,'TEXTURE',.32,.65,.75,.17,{type:'BP',cutoff:930,q:.65,mix:.65})]},
 {id:'forensic-ritual',name:'Анализ · Ritual Transmutation',genre:'Forensics / Ритуальные атмосферы',bpm:196,description:'Исследованные ритуальные удары, бас и медленная тональная атмосфера (DSP-реконструкция).',layers:[
  layer('TEK Perc 01 · Perc',.23,'GROOVE',.35,.08,5,.3),
  layer('TEK Bass I 18 · Bass',.25,'PULSE',.5,.1,7,.27),
  layer('Ritual Env 10 · Atmos',.27,'DRONE',.52,.9,.4,.28),
  layer('Phyllorum 08 · Texture',.15,'TEXTURE',.3,.65,1,.2)]},
 {id:'forensic-organic',name:'Анализ · Organic Pulses',genre:'Forensics / Органическая перкуссия',bpm:210,description:'Органическая многослойная пульсация, циклическая перкуссия и басовые фактуры.',layers:[
  layer('TEK Perc 06 · Perc',.25,'GROOVE',.38,.1,6,.25),
  layer('TEK Bass II 05 · Bass',.25,'PULSE',.45,.12,8,.34),
  layer('Ritual Env 07 · Pulse',.2,'TEXTURE',.42,.4,1.6,.31),
  layer('Ritual Env 02 · Atmos',.22,'DRONE',.5,.7,.4,.2)]},
 {id:'forensic-cavern',name:'Анализ · Cavern Resonances',genre:'Forensics / Металлическая перкуссия',bpm:184,description:'Металлическая перкуссия, тёмный басовый дрон и пещерные резонансы.',layers:[
  layer('TEK Perc 03 · Perc',.23,'GROOVE',.33,.08,6,.26),
  layer('TEK Bass I 01 · Bass',.25,'DRONE',.44,.6,.6,.22),
  layer('Ritual Env 12 · Atmos',.25,'DRONE',.45,.8,.5,.2),
  layer('Phyllorum 38 · Atmos',.16,'TEXTURE',.26,.6,1,.22)]},
 {id:'forensic-horror',name:'Анализ · Horror Fragments',genre:'Forensics / Экспериментальная перкуссия',bpm:230,description:'Нарезанные перкуссионные события, атмосферный мотив и ритуальные акценты.',layers:[
  layer('Phyllorum 16 · Texture',.31,'GLITCH',.55,.08,12,.5),
  layer('Phyllorum 22 · Perc',.14,'TEXTURE',.33,.18,4,.28),
  layer('Ritual Env 01 · Atmos',.29,'DRONE',.55,.75,.45,.2),
  layer('TEK Perc 10 · Perc',.19,'GROOVE',.4,.11,7,.34)]}
];

export function buildMasterSession(id,source='AUDIO',idFactory=(i)=>`scene-${id}-${i}`){
 const scene=masterPresets.find(p=>p.id===id);
 if(!scene)throw Error('Неизвестный мастер-пресет: '+id);
 if(!['AUDIO','MIDI'].includes(source))throw Error('Неверный источник управления');
 const states=scene.layers.map((layer,i)=>{
  const index=synthPresets.findIndex(p=>p[0]===layer.preset);
  if(index<0)throw Error('В мастер-пресете не найден слой '+layer.preset);
  const [name,os,values,meta]=synthPresets[index],params=defaults(os);
  for(const [key,value] of Object.entries(values))params[Number(key)]=value;
  const midi={...midiDefaults(os),...structuredClone(meta.midi||{}),source:'FILE',enabled:source==='MIDI',assignment:'AUTO',mode:'MODULATION',pitchTracking:os===22?1:.7,depth:layer.depth,balance:.35,intensity:.78};
  return extensionDefaults({version:1,masterScene:scene.id,name:name.slice(0,40),os,params,seed:meta.seed,mode:'AS',fixed:true,volume:layer.volume,sync:true,instanceId:idFactory(i),presetId:index,midi,
   frequencyFilter:layer.filter||{type:'OFF',cutoff:12000,q:.707,mix:1},
   generative:{source,character:layer.character,depth:layer.depth,response:layer.response,density:layer.density,variation:layer.variation}});
 });
 return {version:2,tempo:scene.bpm,presets:states,activePreset:0};
}

// A normal auto-router assigns each MIDI track to just one synth tab. Master
// scenes are layered: even a single-track MIDI file should drive all four
// complementary roles. Preserve the best auto assignments, then fill gaps.
export function isMasterMidiSession(presets){
 return presets.length===4&&presets.every(p=>p.masterScene&&p.masterScene===presets[0].masterScene&&p.generative?.source==='MIDI');
}
export function routeMasterMidi(file,presets){
 const tracks=file.tracks.filter(t=>t.notes.length);if(!tracks.length)return [];
 const router=new MidiAutoRouter();router.auto(file,presets);
 for(const p of presets){
  if(router.routes.some(r=>r.presetInstanceId===p.instanceId))continue;
  const best=tracks.map(t=>({track:t,...compatibility(analyzeTrack(t),engineRegistry[p.os])})).sort((a,b)=>b.compatibilityScore-a.compatibilityScore)[0];
  router.routes.push({trackId:best.track.id,presetInstanceId:p.instanceId,compatibilityScore:best.compatibilityScore,reason:'Мастер-сцена · дополнительная роль: '+best.reason,mode:p.midi.mode,transpose:0,intensity:1,manual:false});
 }
 return router.routes;
}
