const TAU=Math.PI*2;
const HARMONIC_MINOR=[0,3,7,10,14,17],HARMONIC_MAJOR=[0,4,7,11,14,19];
class Field{
 constructor(sr,seed){this.sr=sr;this.reset(seed);this.phases=new Float64Array(56);this.l=0;this.r=0;this.env=0;this.time=0}
 reset(seed){this.seed=seed>>>0||1;this.time=0;this.env=0;this.phases?.fill(0)}
 rand(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296}
 silence(){this.env=0}
 trigger(i,amp){this.env=Math.max(this.env,amp*.1);this.until=0;this.forced=true;this.dirty=true}
 prepare(p,pads,as,midi){this.time++;const touch=Math.max(pads[0],pads[1],pads[2]);this.env+=((as?1:touch)-this.env)*(1-Math.exp(-1/(this.sr*(touch||as?Math.max(.02,p[4]*.2):p[4]))));this.l=0;this.r=0;this.midi=midi;this.autoGain=this.env*(midi.settings.enabled?(midi.settings.mode==='NOTE'?0:midi.settings.mode==='HYBRID'?1-.75*midi.settings.balance:1):1);this.noteGain=midi.settings.enabled&&midi.settings.mode!=='MODULATION'?midi.settings.balance*midi.settings.intensity:0}
 layer(i,p){if(i===0){this.freq=p[0]*(1+this.midi.stereo*.01);this.amp=this.autoGain;return}const v=this.midi.voices[i-1];this.freq=(p[0]*(1-this.midi.settings.pitchTracking)+v.frequency*this.midi.settings.pitchTracking)*this.midi.frequency;this.amp=v.env*(1-this.midi.settings.velocitySensitivity+v.velocity*this.midi.settings.velocitySensitivity)*this.noteGain*this.midi.amplitude/2.45}
}
export class DeepDrone extends Field{
 constructor(sr,seed){super(sr,seed);this.increment=new Float64Array(56);this.weight=new Float64Array(8);this.pan=new Float64Array(8);this.dirty=true;for(let i=0;i<56;i++)this.phases[i]=this.rand()}
 reset(seed){super.reset(seed);if(this.phases)for(let i=0;i<56;i++)this.phases[i]=this.rand();this.dirty=true}
 sample(p,pads,held,as,midi){this.prepare(p,pads,as,midi);const update=this.time%32===1||this.dirty,t=this.time/this.sr;if(update)for(let j=0;j<8;j++){this.weight[j]=(j===0?p[7]:Math.exp(-j*(1.2-p[3])))*.18;this.pan[j]=Math.sin(t*p[1]*(.1+p[6])+j*1.9)*p[9]*.7}for(let v=0;v<7;v++){this.layer(v,p);if(this.amp<1e-8)continue;for(let j=0;j<8;j++){const k=v*8+j;if(update){const ratio=j===0?.5:(j*(1+p[2]*j*.037));this.increment[k]=Math.min(this.sr*.4,this.freq*ratio*(1+Math.sin(t*p[1]+j*1.7)*p[5]*.009))/this.sr}this.phases[k]=(this.phases[k]+this.increment[k])%1;const z=Math.sin(TAU*this.phases[k])*this.weight[j]*this.amp;this.l+=z*(1-this.pan[j]);this.r+=z*(1+this.pan[j])}}this.dirty=false}
}
export class SpectralFog extends Field{
 constructor(sr,seed){super(sr,seed);this.y=new Float64Array(42);this.z=new Float64Array(42);this.a=new Float64Array(42);this.pan=new Float64Array(6);this.gain=new Float64Array(6);this.dirty=true}
 reset(seed){super.reset(seed);this.y?.fill(0);this.z?.fill(0);this.dirty=true}
 sample(p,pads,held,as,midi){this.prepare(p,pads,as,midi);const update=this.time%32===1||this.dirty,t=this.time/this.sr;if(update){this.radius=Math.exp(-1/(this.sr*(.008+p[2]*p[4])));for(let j=0;j<6;j++){this.gain[j]=(.03+p[3]*.3)*(1-this.radius)*(.15+p[7]*j*.3);this.pan[j]=Math.sin(j*2.3+t*p[1]*.4)*p[9]}}for(let v=0;v<7;v++){this.layer(v,p);for(let j=0;j<6;j++){const k=v*6+j;if(update){const f=Math.min(this.sr*.38,this.freq*(1+j*(.4+p[5]*2))*(1+Math.sin(t*p[1]+j)*p[6]*.12));this.a[k]=2*this.radius*Math.cos(TAU*f/this.sr)}const excitation=(this.rand()*2-1)*this.amp*this.gain[j];const y=excitation+this.a[k]*this.y[k]-this.radius*this.radius*this.z[k];this.z[k]=this.y[k];this.y[k]=Number.isFinite(y)?y:0;this.l+=y*(1-this.pan[j])*.15;this.r+=y*(1+this.pan[j])*.15}}this.dirty=false}
}
export class NoiseLab extends Field{
 constructor(sr,seed){super(sr,seed);this.pink=new Float64Array(2);this.brown=new Float64Array(2);this.prev=new Float64Array(2);this.low=new Float64Array(2);this.burst=0}
 sample(p,pads,held,as,midi){this.prepare(p,pads,as,midi);let energy=this.autoGain,f=p[0];for(let v=1;v<7;v++){this.layer(v,p);energy+=this.amp;f+=this.freq*this.amp*.4}if(this.rand()<(p[3]*100+.1)/this.sr)this.burst=1;this.burst*=Math.exp(-1/(this.sr*p[4]*.08));const common=this.rand()*2-1;for(let c=0;c<2;c++){const w=common*(1-p[5]*p[9])+(this.rand()*2-1)*p[5]*p[9];this.pink[c]=this.pink[c]*.97+w*.03;this.brown[c]=Math.max(-1,Math.min(1,this.brown[c]*.999+w*.015));const blue=(w-this.prev[c])*.5;this.prev[c]=w;const colour=p[2]*3;let n=colour<1?w*(1-colour)+this.pink[c]*5*colour:colour<2?this.pink[c]*5*(2-colour)+this.brown[c]*(colour-1):this.brown[c]*(3-colour)+blue*(colour-2);const cut=Math.min(this.sr*.35,f*(1+p[7]*12)*(1+Math.sin(this.time/this.sr*p[1])*.8*p[6]));const a=1-Math.exp(-TAU*cut/this.sr);this.low[c]+=(n-this.low[c])*a;n=(this.low[c]+this.burst*w*p[3])*energy*.22;if(c)this.r=n;else this.l=n}}
}
export class FeedbackHabitat extends Field{
 constructor(sr,seed){super(sr,seed);this.lines=Array.from({length:4},()=>new Float32Array(Math.ceil(sr*.1)));this.pos=0;this.low=new Float64Array(4);this.tap=new Float64Array(4)}
 reset(seed){super.reset(seed);this.lines?.forEach(l=>l.fill(0));this.low?.fill(0)}
 sample(p,pads,held,as,midi){this.prepare(p,pads,as,midi);let energy=this.autoGain,f=p[0];for(let v=1;v<7;v++){this.layer(v,p);energy+=this.amp;f+=this.freq*this.amp*.15}const length=this.lines[0].length,t=this.time/this.sr;for(let j=0;j<4;j++){const delay=Math.max(2,Math.min(length-1,Math.floor(this.sr/(f*(1+j*.37))*(1+Math.sin(t*p[1]+j)*p[6]*.1))));this.tap[j]=this.lines[j][(this.pos+length-delay)%length]}
 // Convex coupling has row sum 1; gain < .985 and tanh is bounded.
 const feedback=.1+p[2]*.884;for(let j=0;j<4;j++){const x=this.tap[j]*(1-p[5])+this.tap[(j+1)%4]*p[5];this.low[j]+=(x-this.low[j])*(.005+.7/(1+p[4]));const impulse=(this.rand()*2-1)*energy*(.0002+p[3]*.025)*midi.excitation;const y=Math.tanh((this.low[j]*feedback+impulse)*(1+p[7]*2))/(1+p[7]*2);this.lines[j][this.pos]=Number.isFinite(y)?y:0;this.l+=y*(j%2?1-p[9]:1);this.r+=y*(j%2?1:1-p[9])}this.pos=(this.pos+1)%length;this.l*=2;this.r*=2}
}
export class TapeDecay extends Field{
 constructor(sr,seed){super(sr,seed);this.tapeL=new Float32Array(sr*2);this.tapeR=new Float32Array(sr*2);this.pos=0;this.lowL=0;this.lowR=0;this.dropout=1}
 reset(seed){super.reset(seed);this.tapeL?.fill(0);this.tapeR?.fill(0)}
 sample(p,pads,held,as,midi){this.prepare(p,pads,as,midi);const t=this.time/this.sr;let source=0;for(let v=0;v<7;v++){this.layer(v,p);const wow=Math.sin(t*TAU*p[1])*.012+Math.sin(t*TAU*17)*p[2]*.004+Math.sin(t*.13)*p[5]*.025;this.phases[v]=(this.phases[v]+this.freq*(1+wow)/this.sr)%1;source+=(Math.sin(TAU*this.phases[v])+.24*Math.sin(TAU*this.phases[v]*3))*this.amp*.12}if(this.time%256===0)this.dropout=this.rand()<p[6]*.12?.08:1;source=source*this.dropout+(this.rand()*2-1)*p[3]*(this.rand()<.0007?.2:.006)*this.env;const len=this.tapeL.length,delay=Math.floor(this.sr*(.31+p[5]*.9)),idx=(this.pos+len-delay)%len;const a=.02+(1-p[7])*.7;this.lowL+=(this.tapeL[idx]-this.lowL)*a;this.lowR+=(this.tapeR[(idx+71)%len]-this.lowR)*a;const decay=Math.exp(-delay/(this.sr*p[4]));this.l=Math.tanh(source+this.lowL*decay);this.r=Math.tanh(source*(1-p[9]*.25)+this.lowR*decay);this.tapeL[this.pos]=this.l;this.tapeR[this.pos]=this.r;this.pos=(this.pos+1)%len}
}
export class MicrosoundSwarm extends Field{
 constructor(sr,seed){super(sr,seed);this.particles=Array.from({length:32},()=>({age:0,len:0,f:0,pan:0,amp:0,phase:0}));this.until=0}
 reset(seed){super.reset(seed);this.particles?.forEach(v=>v.len=0);this.until=0}
 sample(p,pads,held,as,midi){this.prepare(p,pads,as,midi);let energy=this.autoGain;if(as&&this.time===Math.round(this.sr*.02)){this.forced=true;this.until=0}for(const v of midi.voices)energy+=v.env*v.velocity*this.noteGain*.3;if(--this.until<=0){this.until=Math.max(1,Math.floor(-Math.log(Math.max(.00001,this.rand()))*this.sr/(.1+p[1]*(1+p[3]*30))));if((this.forced||this.rand()>p[6]*.8)&&energy>.0001){const grain=this.particles.find(v=>v.len===0);if(grain){const layer=Math.floor(this.rand()*7);this.layer(layer,p);grain.f=Math.min(this.sr*.35,(this.amp>.001?this.freq:p[0])*2**((this.rand()-.5)*p[5]*6));grain.age=0;grain.len=Math.max(8,Math.floor(this.sr*Math.min(.5,p[4])*(.1+this.rand()*.9)));grain.pan=(this.rand()*2-1)*p[9];grain.amp=energy*.3;grain.phase=0;this.forced=false}}}
 for(const v of this.particles){if(!v.len)continue;v.phase=(v.phase+v.f/this.sr)%1;const env=Math.sin(Math.PI*v.age/v.len)*Math.exp(-v.age/v.len*p[7]*8);const z=(Math.sin(TAU*v.phase)*(1-p[2])+(this.rand()*2-1)*p[2])*env*v.amp;this.l+=z*(1-v.pan);this.r+=z*(1+v.pan);if(++v.age>=v.len)v.len=0}}
}


// Tonal chords rather than broadband noise. The update of frequency and panning
// coefficients is decimated to 64 samples for real-time browser performance.
export class HarmonicBloom extends Field{
 constructor(sr,seed){super(sr,seed);this.phaseBank=new Float64Array(42);this.increment=new Float64Array(42);this.movement=new Float64Array(42);this.panBank=new Float64Array(42);this.smooth=new Float64Array(7);this.accent=0;this.attack=.001;this.release=.0001}
 reset(seed){super.reset(seed);this.phaseBank?.fill(0);this.smooth?.fill(0);this.accent=0}
 trigger(i,amp){super.trigger(i,amp);this.accent=Math.max(this.accent,amp*.6)}
 sample(p,pads,held,as,midi){
  this.prepare(p,pads,as,midi);this.accent*=.9998;
  const update=this.time%64===1,t=this.time/this.sr;
  const notes=p[3]>.5?HARMONIC_MAJOR:HARMONIC_MINOR;
  if(update){this.attack=1-Math.exp(-1/(this.sr*Math.max(.03,p[4]*.18)));this.release=1-Math.exp(-1/(this.sr*p[4]))}
  const voices=midi.settings.enabled&&midi.settings.mode!=='MODULATION'?7:1;
  for(let voice=0;voice<voices;voice++){
   this.layer(voice,p);const target=this.amp*(voice===0?1:.32);
   this.smooth[voice]+=(target-this.smooth[voice])*(target>this.smooth[voice]?this.attack:this.release);
   if(this.smooth[voice]<1e-7)continue;
   for(let note=0;note<6;note++){
    const k=voice*6+note;
    if(update){const f=Math.min(this.sr*.43,this.freq*2**(notes[note]/12)*(1+Math.sin(t*p[1]+k*1.73)*(.002+p[5]*.018)));
     this.increment[k]=f/this.sr;this.movement[k]=(.72+.28*Math.sin(t*p[1]*.5+note*.8))*(.5+p[7]*.5);
     this.panBank[k]=Math.sin(note*1.7+t*p[6]*.26)*p[9]*.6}
    this.phaseBank[k]=(this.phaseBank[k]+this.increment[k])%1;
    const ph=TAU*this.phaseBank[k],fundamental=Math.sin(ph),harmonic=Math.sin(2*ph)*(.06+p[2]*.16);
    const z=(fundamental+harmonic)*this.movement[k]*this.smooth[voice]*(note===0?.082:.037)*(1+this.accent*.24);
    const pan=this.panBank[k];this.l+=z*(1-pan);this.r+=z*(1+pan);
   }
  }
 }
}
export const ambientClasses={'deep-drone':DeepDrone,'spectral-fog':SpectralFog,'noise-lab':NoiseLab,'feedback-habitat':FeedbackHabitat,'tape-decay':TapeDecay,'microsound-swarm':MicrosoundSwarm,'harmonic-bloom':HarmonicBloom};
