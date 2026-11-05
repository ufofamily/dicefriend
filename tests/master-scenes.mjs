import assert from 'node:assert/strict';
import {masterPresets,buildMasterSession,isMasterMidiSession,routeMasterMidi} from '../src/masterPresets.js';
import {SynthCore} from '../src/dsp.js';
import {systems} from '../src/parameters.js';
import {validExtensions} from '../src/generative/settings.js';
import {Generator} from '../src/generative/Generator.js';
const sr=24000,l=new Float32Array(128),r=new Float32Array(128),audio=new Float32Array(128);
assert.equal(systems.length,24);assert.equal(masterPresets.length,6);
for(const scene of masterPresets){
 for(const source of ['AUDIO','MIDI']){
  const session=buildMasterSession(scene.id,source,index=>`${scene.id}-${source}-${index}`);
  assert.equal(session.presets.length,4);assert.equal(session.tempo,scene.bpm);
  const serials=new Set();let audible=0;
  for(const p of session.presets){
   assert.equal(p.generative.source,source);assert(p.sync&&p.fixed);assert(validExtensions(p));assert(p.midi.mode==='MODULATION');assert(!serials.has(p.instanceId));serials.add(p.instanceId);
   const core=new SynthCore(sr,p.os,p.seed);core.setExtensions(p);core.setMode(p.mode);p.params.forEach((v,i)=>core.setParameter(i,v));
   if(source==='MIDI'){core.setMidiModulation({...p.midi,enabled:true});core.enqueueMidi([{type:'on',note:51,velocity:.82,frame:0},{type:'off',note:51,frame:sr}])}
   const clock={at:0,beat:0,bpm:scene.bpm,running:true,source:'INTERNAL',loop:false,origin:0};core.transport=clock;
   for(let frame=0;frame<sr;frame+=128){for(let i=0;i<128;i++)audio[i]=Math.sin(2*Math.PI*124*(frame+i)/sr)*.42;core.render(l,r,frame,audio,audio);for(const v of l){assert(Number.isFinite(v)&&Math.abs(v)<=.851);audible+=v*v}}
  }
  assert(audible>.00001,`${scene.id} ${source} silent`);
 }
 console.log('PASS master scene',scene.id);
}
// Even a monophonic or single-track MIDI file must excite every layer.
const testScene=buildMasterSession('forensic-ritual','MIDI');
assert(isMasterMidiSession(testScene.presets));
const mono={tracks:[{id:'melody',notes:[{note:62,beat:0,duration:1,velocity:.8},{note:65,beat:1,duration:1,velocity:.75}],durationBeats:2,name:'Piano',channel:0,program:0}]};
const monoRoutes=routeMasterMidi(mono,testScene.presets);
assert.equal(monoRoutes.length,4);
assert.equal(new Set(monoRoutes.map(r=>r.presetInstanceId)).size,4);
assert(monoRoutes.every(r=>r.trackId==='melody'));
assert.equal(routeMasterMidi({tracks:[]},testScene.presets).length,0);
const g=new Generator(sr,123,'percussion');g.configure({source:'AUDIO',character:'TEXTURE',response:.1,density:3});
let attackEvents=0,silenceEvents=0;
for(let n=0;n<sr;n++){const signal=n%6000<300?Math.sin(2*Math.PI*110*n/sr)*.7:0;g.tick(signal,signal,{},n);if(g.event)attackEvents++}
for(let n=sr;n<sr*3;n++){g.tick(0,0,{},n);if(g.event)silenceEvents++}
assert(attackEvents>0&&attackEvents<20,'transient scheduler controlled density');
assert(silenceEvents<6,'silence must prevent indefinite excitations');
const midi={settings:{enabled:true},noteOnCount:0,sources:{gate:0,velocity:0,density:0,pitch:.5,polyphony:0}};
const gm=new Generator(sr,456,'chords');gm.configure({source:'MIDI',character:'TEXTURE',response:.05});
let midiEvents=0;for(let n=0;n<sr;n++){if(n===sr/10){midi.noteOnCount=1;Object.assign(midi.sources,{gate:1,velocity:.8,pitch:.42})}gm.tick(0,0,midi,n);if(gm.event)midiEvents++}
assert(midiEvents>0&&midiEvents<20,'MIDI onset must excite, not machine-gun');
console.log('PASS transient follower, MIDI note-on, bounded density and 6×2 master scenes with forensic sources');
