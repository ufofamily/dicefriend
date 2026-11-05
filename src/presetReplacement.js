import {defaults,midiDefaults} from './parameters.js';
import {extensionDefaults} from './generative/settings.js';

// Build a replacement *state* without mutating the original. This is used only
// for the active tab, and deliberately preserves its instanceId and routing.
export function buildReplacementState(old,preset,presetId){
 if(!old||!Array.isArray(preset)||!Number.isInteger(presetId))throw Error('Invalid preset replacement');
 const [name,os,values,meta={}]=preset;
 const midi=old.midi||{};
 const state=extensionDefaults({
  ...old,name,os,presetId,seed:meta.seed??old.seed,
  params:defaults(os),
  midi:{...midiDefaults(os),...structuredClone(meta.midi||{}),
   source:midi.source??'FILE',enabled:midi.enabled??false,
   assignment:midi.assignment??'AUTO',mode:midi.mode??'HYBRID',
   channel:midi.channel??-1,minNote:midi.minNote??0,maxNote:midi.maxNote??127,
   transpose:midi.transpose??0,octave:midi.octave??0},
  generative:{...old.generative,...meta.excitation,source:old.generative?.source??'OFF'},
  frequencyFilter:{...old.frequencyFilter}
 });
 for(const [index,value] of Object.entries(values||{}))state.params[Number(index)]=value;
 return state;
}
