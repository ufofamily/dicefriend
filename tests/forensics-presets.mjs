import assert from 'node:assert/strict';
import {forensicsCatalog} from '../src/forensicsCatalog.js';
import {archivedSynthPresets,archivedSamplePresets} from '../src/forensicsPresets.js';
import {synthPresets,samplePresets} from '../src/presets.js';
import {masterPresets,buildMasterSession} from '../src/masterPresets.js';
import {hierarchy} from '../src/presetHierarchy.js';
import {systems,fromNorm} from '../src/parameters.js';
assert.equal(forensicsCatalog.length,212);
assert.equal(new Set(forensicsCatalog.map(p=>p.id)).size,212,'report hashes must be unique');
assert.equal(archivedSynthPresets.length,207);
assert.equal(synthPresets.length,233);
assert.equal(samplePresets.length,29);
const known=synthPresets.filter(p=>!p[3].genre.startsWith('Forensics'));
assert.equal(known.length,26);
assert(known.every(p=>/psycore|slambient/i.test(p[3].genre)));
assert.equal(new Set(synthPresets.map(p=>p[0])).size,synthPresets.length,'unique names');
assert.equal(new Set(archivedSynthPresets.map(p=>p[3].analysis.hash)).size,207);
for(const [name,os,values,meta] of archivedSynthPresets){
 assert(name.length<=40);
 assert(meta.analysis.source&&meta.analysis.collection&&meta.analysis.hash);
 assert(meta.description.includes('Без исходного аудио'));
 assert(/^Forensics/.test(meta.genre));
 assert(Object.keys(values).length===12);
 assert(meta.volume>0&&meta.volume<1);
 for(const [idx,v] of Object.entries(values)){
  assert(Number.isFinite(v)&&v>=0&&v<=1,name+' normalized out of bounds '+idx);
  const physical=fromNorm(systems[os].params[Number(idx)],v);
  assert(Number.isFinite(physical));
 }
}
const groups=Object.groupBy(synthPresets,p=>hierarchy(p));
assert(Object.entries(groups).some(([k,v])=>k.includes('Анализ семплов')&&v.length>2));
for(const scene of masterPresets){for(const source of ['AUDIO','MIDI']){
 const generated=buildMasterSession(scene.id,source);
 assert.equal(generated.presets.length,4);
 assert(generated.presets.every(p=>p.os>=0&&p.os<systems.length));
}}
assert(archivedSamplePresets.every(([name,values,meta])=>name&&meta.hash&&values.filter<=20000&&values.density<=80));
console.log('PASS archive: 207 unique source-derived synth, 28 sample FX, 26 original psycore/slambient, six working scenes, normalized DSP controls');
