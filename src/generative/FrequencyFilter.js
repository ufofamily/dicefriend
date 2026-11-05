import {filterDefaults} from './settings.js';
// Stereo topology-preserving state-variable filter. Parameters glide at control rate.
export class FrequencyFilter{
 constructor(sr){this.sr=sr;this.settings={...filterDefaults};this.cutoff=12000;this.q=.707;this.wet=0;this.state=new Float64Array(4);this.count=0;this.update()}
 configure(s){Object.assign(this.settings,s)}
 update(){const s=this.settings;this.cutoff+=(s.cutoff-this.cutoff)*.08;this.q+=(s.q-this.q)*.08;this.wet+=((s.type==='OFF'?0:s.mix)-this.wet)*.08;this.g=Math.tan(Math.PI*Math.min(this.sr*.45,this.cutoff)/this.sr);this.k=1/this.q;this.a=1/(1+this.g*(this.g+this.k))}
 process(x,ch){if(this.settings.type==='OFF'&&this.wet<1e-8){this.state.fill(0);return x}if(ch===0&&this.count++%32===0)this.update();const i=ch*2,v3=x-this.state[i+1],v1=this.a*(this.state[i]+this.g*v3),v2=this.state[i+1]+this.g*v1;this.state[i]=2*v1-this.state[i];this.state[i+1]=2*v2-this.state[i+1];const high=x-this.k*v1-v2,type=this.settings.type,y=type==='HP'?high:type==='BP'?v1*this.k:type==='NOTCH'?high+v2:v2;return x+(y-x)*this.wet}
}
