import assert from 'node:assert/strict';
import {SampleProcessor,sampleDefaults} from '../src/audio/SampleProcessor.js';
import {Transport,transportBeat} from '../src/audio/Transport.js';
import {encodeWav} from '../src/audio/wav.js';
import {validateProject} from '../src/audio/ProjectState.js';
const sr=48000,l=new Float32Array(128),r=new Float32Array(128);
const signal=Float32Array.from({length:sr*2},(_,i)=>Math.sin(2*Math.PI*220*i/sr)*.3);
function render(params={},seconds=.3){const p=new SampleProcessor(sr);p.load([signal,signal]);p.configure({...sampleDefaults,loopEnd:2,...params});p.playing=true;let energy=0;for(let f=0;f<seconds*sr;f+=128){l.fill(0);r.fill(0);p.render(l,r,f/sr);for(const x of l){assert(Number.isFinite(x));energy+=x*x}}return {p,energy}}
const normal=render();assert(normal.energy>1,'sample must produce real audio');
const fast=render({rate:2});assert(fast.p.position>normal.p.position*1.8,'rate changes cursor');
const pitch=render({pitch:12});assert(Math.abs(pitch.p.position-fast.p.position)<1,'pitch has documented rate coupling');
const granular=render({grainSize:.05,density:30});assert(granular.energy>1,'grain output');
assert.notEqual(granular.energy,normal.energy);
const reverse=new SampleProcessor(sr);reverse.load([signal,signal]);reverse.configure({...sampleDefaults,reverse:true,loopEnd:2});reverse.seek(1);reverse.playing=true;for(let f=0;f<4800;f+=128)reverse.render(l,r,f/sr);assert(reverse.position<sr,'reverse moves backward after glide');
const paused=render().p;paused.playing=false;for(let f=0;f<sr;f+=128){l.fill(0);r.fill(0);paused.render(l,r,f/sr)}assert(Math.max(...l.map(Math.abs))<.00001,'release to silence');
const clock=new Transport();const context={currentTime:0};clock.bind(context);clock.start();context.currentTime=1;const before=clock.beat;clock.setBpm(180);assert.equal(clock.beat,before,'BPM edits preserve phase');clock.stop();context.currentTime=3;assert.equal(clock.beat,before,'Stop freezes phase');clock.reset();assert.equal(clock.beat,0);clock.start();assert(clock.nextTime()>=context.currentTime+.059);
assert.equal(transportBeat({beat:0,at:0,bpm:120,running:true,loop:true,loopStart:0,loopEnd:4},3),2);
for(const bits of [16,24]){const bytes=bits/8,wav=encodeWav([new Float32Array([-1,0,1,NaN]),new Float32Array([1,0,-1,0])],44100,bits),v=new DataView(wav);assert.equal(new TextDecoder().decode(wav.slice(0,4)),'RIFF');assert.equal(v.getUint32(4,true),wav.byteLength-8);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint16(34,true),bits);assert.equal(v.getUint32(40,true),4*2*bytes);if(bits===16){assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(46,true),32767)}else{assert.deepEqual([...new Uint8Array(wav,44,6)],[0,0,128,255,255,127])}}
assert.equal(validateProject({version:3},()=>true),false);
console.log('PASS studio: sample signal, rate/pitch, reverse, grains, pause, clock phase/loop, PCM16/24 headers and samples');
