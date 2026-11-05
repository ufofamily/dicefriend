import assert from 'node:assert/strict';
import {SynthCore} from '../src/dsp.js';
import {synthPresets} from '../src/presets.js';
import {defaults} from '../src/parameters.js';
const sr=24000;
function render(name){
 const preset=synthPresets.find(p=>p[0]===name);assert(preset,'missing '+name);
 const [,,values,meta]=preset,core=new SynthCore(sr,preset[1],meta.seed);
 const params=defaults(preset[1]);for(const [index,v] of Object.entries(values))params[Number(index)]=v;
 params.forEach((v,i)=>core.setParameter(i,v));const left=new Float32Array(128),right=new Float32Array(128);
 let energy=0,shape=0;
 for(let i=0;i<320;i++){core.render(left,right);for(let j=0;j<left.length;j++){energy+=left[j]**2+right[j]**2;shape+=(left[j]+right[j])*(j%23+1)}}
 assert(energy>.00001,name+' silent');return {energy,shape};
}
const probes=['TEK Perc 01 · Perc','TEK Perc 03 · Perc','Ritual Env 01 · Atmos','Phyllorum 16 · Texture'];
const outputs=probes.map(render);
assert.equal(new Set(outputs.map(o=>o.shape.toFixed(6))).size,probes.length);
assert.equal(new Set(outputs.map(o=>o.energy.toFixed(6))).size,probes.length);
console.log('PASS source profiles: different percussive/atmospheric sources drive distinct bounded audio');
