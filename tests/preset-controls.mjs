import assert from 'node:assert/strict';
import {synthPresets} from '../src/presets.js';
import {systems,defaults,midiDefaults} from '../src/parameters.js';
import {extensionDefaults,validExtensions} from '../src/generative/settings.js';
import {controlPagesForPreset,readControl,writeControl,controlInactive} from '../src/presetControls.js';
import {sameCategoryCandidates,chooseCategoryPreset,replacementCandidates,chooseReplacement} from '../src/categoryDice.js';
import {validateMidiConfig} from '../src/midi/state.js';
import {buildReplacementState} from '../src/presetReplacement.js';

for(const [index,preset] of synthPresets.entries()){
 const os=preset[1],layout=controlPagesForPreset(preset,os);
 assert.equal(layout.pages.length,3,`pages for ${index}`);
 assert.deepEqual(layout.pages.map(page=>page.controls.length),[6,6,6]);
 const dsp=[...layout.pages[0].controls,...layout.pages[1].controls];
 assert.deepEqual([...new Set(dsp.map(c=>c.index))].sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i),`all real DSP knobs reachable ${index}`);
 assert(layout.role);assert(layout.category);
 let state=extensionDefaults({os,params:defaults(os),generative:{source:'AUDIO'},midi:midiDefaults(os)});
 for(const control of [...dsp,...layout.pages[2].controls]){
  assert(control.name.length>0);
  const before=readControl(state,control);
  assert(Number.isFinite(before)&&before>=0&&before<=1);
  const next=before<.49?.75:.25;
  const change=writeControl(state,control,next);
  assert(change.type==='dsp'||change.type==='extensions');
  assert(Math.abs(readControl(state,control)-next)<1e-9,`roundtrip ${index} / ${control.id}`);
  assert.equal(validExtensions(state),true,`extensions remain valid ${index} / ${control.id}`);
  assert.equal(validateMidiConfig(state.midi),true);
 }
 const current=chooseCategoryPreset(synthPresets,index,0);
 assert.equal(current===null,sameCategoryCandidates(synthPresets,index).length===0);
 if(current!==null)assert.equal(controlPagesForPreset(synthPresets[current],synthPresets[current][1]).category,layout.category);
}
const bass=synthPresets.find(p=>p[3].genre==='Forensics / Басовые фактуры'&&p[1]===21);
const kick=synthPresets.find(p=>p[3].genre.includes('Slambient')&&p[1]===20);
const ambient=synthPresets.find(p=>p[3].genre==='Forensics / Ритуальные атмосферы'&&p[1]===22);
assert(bass&&kick&&ambient);
assert.notDeepEqual(controlPagesForPreset(bass,bass[1]).pages[0].controls.map(c=>c.id),controlPagesForPreset(kick,kick[1]).pages[0].controls.map(c=>c.id));
assert.notDeepEqual(controlPagesForPreset(bass,bass[1]).pages[0].controls.map(c=>c.id),controlPagesForPreset(ambient,ambient[1]).pages[0].controls.map(c=>c.id));
for(let i=0;i<synthPresets.length;i++){
 for(const active of [undefined,i,(i+1)%synthPresets.length]){
  const candidates=replacementCandidates(synthPresets,i,active);
  for(const j of candidates)assert(j!==active);
  const picked=chooseReplacement(synthPresets,i,active,4294967295);
  assert.equal(picked===null,candidates.length===0);
  if(picked!==null)assert(candidates.includes(picked));
 }
}
const original=extensionDefaults({version:1,name:'Current',instanceId:'stable-tab-001',seed:321,
 os:21,params:defaults(21),volume:.34,fixed:false,mode:'AS',sync:true,
 midi:{...midiDefaults(21),source:'LIVE',assignment:'MANUAL',channel:2,transpose:-2},
 generative:{source:'MIDI',density:3.5,character:'PULSE'},
 frequencyFilter:{type:'HP',cutoff:700,q:1.2,mix:.4}});
const originalSnapshot=JSON.stringify(original);
for(let i=0;i<synthPresets.length;i++){
 const replacement=buildReplacementState(original,synthPresets[i],i);
 assert.equal(replacement.instanceId,original.instanceId,'routing identity preserved');
 assert.equal(replacement.sync,true);
 assert.equal(replacement.volume,.34);
 assert.equal(replacement.midi.source,'LIVE');
 assert.equal(replacement.midi.channel,2);
 assert.equal(replacement.midi.assignment,'MANUAL');
 assert.equal(replacement.generative.source,'MIDI');
 assert.equal(replacement.frequencyFilter.type,'HP');
 assert.equal(replacement.presetId,i);
 assert.equal(replacement.name,synthPresets[i][0]);
 assert.equal(replacement.params.length,12);
 assert(replacement.params.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
 assert(validExtensions(replacement));assert(validateMidiConfig(replacement.midi));
}
assert.equal(JSON.stringify(original),originalSnapshot,'building replacements never mutates the original tab');
const off=extensionDefaults({params:defaults(21)}),page=controlPagesForPreset(bass,21).pages[2];
assert(controlInactive(off,page.controls[0]));
writeControl(off,page.controls[4],.8);
assert.equal(off.frequencyFilter.type,'LP','touching filter knob enables a real LP filter');
assert(!controlInactive(off,page.controls[4]));
console.log(`PASS 233 contextual preset mappings × 18 controls, sound/detail/motion pages, DSP uniqueness, extension validity, per-category behaviour`);
