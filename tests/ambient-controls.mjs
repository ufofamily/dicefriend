import assert from 'node:assert/strict';
import {SynthCore} from '../src/dsp.js';
import {systems} from '../src/parameters.js';
const al=new Float32Array(128),ar=new Float32Array(128),bl=new Float32Array(128),br=new Float32Array(128);
for(let os=13;os<systems.length;os++){
  for(let parameter=0;parameter<12;parameter++){
    const a=new SynthCore(24000,os,12345),b=new SynthCore(24000,os,12345);
    a.setParameter(parameter,.1);b.setParameter(parameter,.9);
    let difference=0;
    for(let block=0;block<1000;block++){
      a.render(al,ar);b.render(bl,br);
      for(let i=0;i<128;i++)difference+=Math.abs(al[i]-bl[i])+Math.abs(ar[i]-br[i]);
    }
    assert(difference>.01,systems[os].name+' / '+systems[os].params[parameter].name+' has no measurable effect');
  }
  console.log('PASS '+systems[os].name+': all 12 controls affect rendered audio');
}
