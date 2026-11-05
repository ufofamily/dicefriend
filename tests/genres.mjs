import assert from 'node:assert/strict';
import {synthPresets,samplePresets} from '../src/presets.js';
import {systems,defaults,fromNorm} from '../src/parameters.js';
import {SynthCore} from '../src/dsp.js';
import {HardDSP} from '../src/hard-dsp.js';
assert.equal(systems.length,24);assert.equal(synthPresets.length,233);assert.equal(samplePresets.length,29);
const preserved=['Psy Roll · Deep 180','Neuro · Razor','Slam · Temple','Abyss · Sub ocean','Ritual psycore · Obsidian 240','Slambient / Ritual Air','Slambient · Stone harmonics'];
for(const name of preserved)assert(synthPresets.some(p=>p[0]===name),name+' must survive replacement');
assert.equal(synthPresets.filter(p=>p[3].genre.startsWith('Forensics / ')).length,207);
assert(synthPresets.every(p=>p[3].genre.startsWith('Forensics')||/psycore|slambient/i.test(p[3].genre)));
const fingerprints=new Set(),l=new Float32Array(128),r=new Float32Array(128);
for(const [name,os,values,meta] of synthPresets){
 assert(name.length<=40);assert(meta.volume>0&&meta.volume<=1);
 const params=defaults(os);for(const [index,v] of Object.entries(values)){assert(Number.isFinite(v)&&v>=0&&v<=1,name+' invalid parameter');params[index]=v}
 const a=new SynthCore(24000,os,meta.seed??12345),b=new SynthCore(24000,os,meta.seed??12345);
 params.forEach((v,i)=>{a.setParameter(i,v);b.setParameter(i,v)});
 let energy=0,fingerprint=0;const bl=new Float32Array(128),br=new Float32Array(128);
 for(let n=0;n<600;n++){a.render(l,r);b.render(bl,br);assert.deepEqual(l,bl,name+' seed replay');assert.deepEqual(r,br,name+' seed replay');for(let i=0;i<128;i++){assert(Number.isFinite(l[i])&&Math.abs(l[i])<=.851,name+' output bounds');energy+=l[i]*l[i]+r[i]*r[i];fingerprint+=(l[i]+r[i]*.7)*((i%13)+1)}}
 assert(energy>.00001,name+' silent');const signature=fingerprint.toFixed(6);assert(!fingerprints.has(signature),name+' duplicate audio');fingerprints.add(signature);
 if(meta.genre==='Extratone')assert(fromNorm(systems[os].params[0],params[0])>=1000);
 if(meta.genre==='Ambient / Drone'&&os===8){assert.equal(params[7],0);assert.equal(a.bass.kickAmp,0);assert.equal(a.bass.bassAmp,0)}
}
for(const sr of [44100,48000]){
 for(const bpm of [360,580,640,960,1200,1440,1800,2400]){
  const core=new HardDSP(sr,10,77),params=defaults(10).map((v,i)=>fromNorm(systems[10].params[i],v));params[0]=bpm;params[6]=0;
  const pads=new Float64Array(3),held=new Float64Array(3);let previous=0;const onsets=[];
  for(let frame=0;frame<sr*2;frame++){core.sample(params,pads,held,true);if(core.kickCount!==previous){previous=core.kickCount;onsets.push(frame)}}
  assert(Math.abs(onsets.length-bpm/60*2)<=1);
  for(let i=1;i<onsets.length;i++)assert(Math.abs((onsets[i]-onsets[i-1])-sr*60/bpm)<=1.01,'kick interval drift '+bpm);
 }
}
const tek=new HardDSP(48000,11,3),p=defaults(11).map((v,i)=>fromNorm(systems[11].params[i],v)),pads=new Float64Array(3),held=new Float64Array(3);p[6]=0;
let previous=0;for(let step=0;step<32;step++){tek.sample(p,pads,held,true,step);if(tek.bassCount>previous)assert.equal(step%4,2,'hardtek bass must be offbeat');previous=tek.bassCount}
assert.equal(tek.bassCount,8);
console.log('PASS genres: 233 deterministic presets (26 preserved psycore/slambient + 207 analyzed), bounds, legacy high-BPM engine test');
