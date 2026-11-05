import assert from 'node:assert/strict';
import {SynthCore} from '../src/dsp.js';
const sr=48000,l=new Float32Array(128),r=new Float32Array(128);
for(const os of [5,6,7,8,9,10,11,12]){
 const a=new SynthCore(sr,os,7), b=new SynthCore(sr,os,9);
 a.transport=b.transport={bpm:137,origin:256};
 for(let frame=0;frame<sr*3;frame+=128){
  a.render(l,r,frame);
  if(frame>=sr){b.render(l,r,frame);assert.equal(a.bass.step,b.bass.step,'late join must follow shared position')}
 }
 a.randomize(100);a.render(l,r,sr*4);b.render(l,r,sr*4);assert.equal(a.bass.step,b.bass.step,'dice must preserve grid');
 a.transport=null;
 for(let frame=sr*4;frame<sr*5;frame+=128)a.render(l,r,frame);
 assert(a.bass.untilStep>0,'free tempo resumes without accumulated clock debt');
}
for(let os=0;os<5;os++){
 const a=new SynthCore(sr,os,7);a.transport={bpm:120,origin:256};a.render(l,r,0);assert(l.every(v=>v===0));
 a.render(l,r,256);assert.equal(a.lastGridStep,0);
 a.render(l,r,sr);assert.equal(a.lastGridStep,7);
}
console.log('PASS shared clock: late join, seeded reset, free tempo, scheduled start, all systems');
