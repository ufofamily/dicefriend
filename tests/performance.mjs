import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {SynthCore} from '../src/dsp.js';
import {midiDefaults} from '../src/parameters.js';
const sr=48000,l=new Float32Array(128),r=new Float32Array(128);const engines=[3,4,5,9,10,12,13,14,15,16,17,18].map((os,i)=>{const c=new SynthCore(sr,os,17+i);c.setMidiModulation({...midiDefaults(os),mode:'HYBRID'});for(const n of [48,55,60])c.noteOn(n,.5,0,0);return c});
let peak=0;const start=performance.now();for(let block=0;block<375;block++)for(const c of engines){c.render(l,r);for(let i=0;i<128;i++){assert(Number.isFinite(l[i])&&Number.isFinite(r[i]));peak=Math.max(peak,Math.abs(l[i]),Math.abs(r[i]))}}const ms=performance.now()-start;
const feedback=new SynthCore(sr,16,24);for(let i=0;i<12;i++)feedback.setParameter(i,1);for(let block=0;block<11250;block++){feedback.render(l,r);for(let i=0;i<128;i++)assert(Number.isFinite(l[i])&&Number.isFinite(r[i])&&Math.abs(l[i])<.851&&Math.abs(r[i])<.851)}
console.log('PASS resource stress: 12 mixed engines × 3 MIDI notes, 1 s / 48 kHz in '+ms.toFixed(0)+' ms on this host; peak '+peak.toFixed(3)+'; Feedback Habitat 30 s maximum controls bounded');
