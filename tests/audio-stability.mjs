import assert from 'node:assert/strict';
import {OutputConditioner} from '../src/audio/OutputConditioner.js';
import {SynthCore} from '../src/dsp.js';
import {synthPresets} from '../src/presets.js';
import {defaults} from '../src/parameters.js';
const sr = 16000, block = 128;
const left = new Float32Array(block), right = new Float32Array(block);
const conditioner = new OutputConditioner(48000, 2);
for (let n = 0; n < 200; n++) {
  left.fill(n < 140 ? .005 : 0);
  right.fill(n < 140 ? -.005 : 0);
  conditioner.process(left, right);
  assert(left.every(Number.isFinite) && right.every(Number.isFinite));
  assert(left.every(v=>Math.abs(v) <= .831) && right.every(v=>Math.abs(v) <= .831));
}
assert(conditioner.makeup >= 1 && conditioner.makeup <= 4);
const before = JSON.parse((await import('node:fs')).readFileSync(new URL('./audio-level-baseline.json', import.meta.url)));
const beforeByName = before;
let improved = 0, silent = [], low = [], maxPeak = 0, maxDiff = 0;
const results=[];
for(const [index,[name,os,settings,meta]] of synthPresets.entries()) {
  const core = new SynthCore(sr,os,meta.seed??1234),params=defaults(os);
  Object.entries(settings).forEach(([key,value])=>params[+key]=value);
  params.forEach((value,j)=>core.setParameter(j,value));
  let sq=0,peak=0,count=0,diff=0,previous=0;
  for(let n=0;n<150;n++) {
    core.render(left,right);
    for(let i=0;i<block;i++) {
      const a=left[i],b=right[i];
      assert(Number.isFinite(a)&&Number.isFinite(b),`${name} nonfinite`);
      assert(Math.abs(a)<=.831&&Math.abs(b)<=.831,`${name} peak beyond safety ceiling`);
      sq+=(a*a+b*b)*.5;count++;
      peak=Math.max(peak,Math.abs(a),Math.abs(b));
      diff=Math.max(diff,Math.abs(a-previous));previous=a;
    }
  }
  const rms=Math.sqrt(sq/count);
  if(rms===0) silent.push(name);
  if(rms<.01)low.push(name);
  if(rms>=(beforeByName[name]??0)*1.25)improved++;
  maxPeak=Math.max(maxPeak,peak);maxDiff=Math.max(maxDiff,diff);
  results.push({name,rms,peak,diff});
}
// The two slambient bass patches with probabilistically skipped first events are
// now guaranteed a first rolling note; no preset is empty in the test window.
assert.deepEqual(silent,[]);
assert(improved>100,`only ${improved} gained at least 1.9 dB`);
assert(low.length<15,`${low.length} remain quieter than -40 dBFS average`);
console.log(`PASS stability: ${synthPresets.length} presets, ${improved} boosted >=1.9dB, ${low.length} under -40dBFS, peak ${maxPeak.toFixed(3)}, max jump ${maxDiff.toFixed(3)}`);
// Starting an AS engine with a conditional filter change and extreme values
// must not create NaN, denormal explosions or discontinuities beyond ceiling.
for (const os of [0,2,3,5,6,12,16,19,20,21,22,23]) {
 const c=new SynthCore(48000,os,43210);let peak=0;
 for(let n=0;n<120;n++){
  if(n===15)for(let j=0;j<12;j++)c.setParameter(j,1);
  if(n===75)for(let j=0;j<12;j++)c.setParameter(j,0);
  c.render(left,right);
  for(let j=0;j<block;j++){
   assert(Number.isFinite(left[j])&&Number.isFinite(right[j]));
   peak=Math.max(peak,Math.abs(left[j]),Math.abs(right[j]));
  }
 }
 assert(peak<=.831);
}
console.log('PASS stress: modulation and high-frequency ranges remain bounded');
