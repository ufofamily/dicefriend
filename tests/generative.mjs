import assert from 'node:assert/strict';
import {SynthCore} from '../src/dsp.js';
import {FrequencyFilter} from '../src/generative/FrequencyFilter.js';
import {Generator} from '../src/generative/Generator.js';
import {extensionDefaults,validExtensions} from '../src/generative/settings.js';
import {systems,midiDefaults} from '../src/parameters.js';
import {synthPresets} from '../src/presets.js';
import {hierarchy} from '../src/presetHierarchy.js';
const sr=24000;
function filtered(type,freq){const f=new FrequencyFilter(sr);f.configure({type,cutoff:1000,q:.707});let e=0;for(let i=0;i<sr;i++){const x=Math.sin(2*Math.PI*freq*i/sr),y=f.process(x,0);f.process(x,1);if(i>sr/2)e+=y*y;assert(Number.isFinite(y))}return e}
assert(filtered('LP',5000)<filtered('LP',100)*.01);assert(filtered('HP',100)<filtered('HP',5000)*.01);assert(filtered('NOTCH',1000)<filtered('OFF',1000)*.01);assert(filtered('BP',1000)>filtered('BP',100)*10);
for(const type of ['LP','HP','BP','NOTCH'])for(const cutoff of [20,20000]){const f=new FrequencyFilter(sr);f.configure({type,cutoff,q:12});for(let i=0;i<sr;i++)assert(Number.isFinite(f.process(Math.sin(i),i%2)))}
const render=(os,source,inputFrequency=180)=>{const core=new SynthCore(sr,os,123);core.setMode('TS');core.setExtensions(extensionDefaults({generative:{source},frequencyFilter:{type:'LP',cutoff:6000}}));const original=[...core.target];if(source==='MIDI'){core.setMidiModulation({...midiDefaults(os),enabled:true,mode:'NOTE'});core.enqueueMidi([{type:'on',note:40,velocity:.8,frame:256},{type:'off',note:40,frame:sr}])}const l=new Float32Array(128),r=new Float32Array(128),audio=new Float32Array(128);let energy=0;for(let frame=0;frame<sr*2;frame+=128){for(let i=0;i<128;i++)audio[i]=inputFrequency?Math.sin(2*Math.PI*inputFrequency*(frame+i)/sr)*.25:0;core.render(l,r,frame,audio,audio);for(const x of l){assert(Number.isFinite(x)&&Math.abs(x)<=.85);energy+=x*x}}assert.deepEqual(core.target,original);return energy};
for(let os=0;os<systems.length;os++){assert(render(os,'AUDIO')>1e-7,'audio '+os);assert(render(os,'MIDI')>1e-7,'midi '+os);assert.equal(render(os,'AUDIO',0),0,'silent input '+os)}
assert.equal(render(13,'AUDIO'),render(13,'AUDIO'));assert.notEqual(render(13,'AUDIO',100),render(13,'AUDIO',6000));
const a=extensionDefaults({}),b=extensionDefaults(a);b.frequencyFilter.cutoff=100;assert.equal(a.frequencyFilter.cutoff,12000);assert(validExtensions(a));assert(!validExtensions({...a,generative:{...a.generative,depth:NaN}}));
for(const p of synthPresets.filter(p=>['Original','Harsh Noise','Industrial Atmosphere','Microsound','Noise Ambient'].includes(p[3].genre)))assert(hierarchy(p).startsWith('Экспериментальный ›'));
console.log('PASS filters LP/HP/BP/Notch, extreme settings, AUDIO/MIDI generation and silence on all 24 engines, deterministic seed, spectral response, immutable knobs, independent defaults, taxonomy');
