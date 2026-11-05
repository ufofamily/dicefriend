import {generativeDefaults} from './settings.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
// Control-rate feature follower with independent transient detection and seeded phrases.
export class Generator{
 constructor(sr,seed,role='texture'){
  this.sr=sr;this.role=role;this.settings={...generativeDefaults};this.offset=new Float64Array(12);
  this.low=[0,0];this.mid=[0,0];this.energy=0;this.lowEnergy=0;this.highEnergy=0;
  this.fast=0;this.slow=0;this.level=0;this.brightness=0;this.pitch=.5;this.gain=1;
  this.phase=0;this.motion=0;this.event=false;this.estimatedBpm=170;this.tonalHz=0;this.tonalConfidence=0;this.prevLow=0;this.lastCross=-1e9;this.reset(seed);this.configure({});
 }
 reset(seed){this.seed=(seed^0x9e3779b9)>>>0||1;this.phase=0;this.motion=0;this.drift=0;this.lastStep=-1;this.lastMidiCount=0;this.lastOnsetFrame=-1e9;this.lastEventFrame=-1e9;this.energy=this.lowEnergy=this.highEnergy=this.fast=this.slow=this.level=0;this.low.fill(0);this.mid.fill(0);this.tonalHz=0;this.tonalConfidence=0;this.prevLow=0;this.lastCross=-1e9}
 random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296}
 configure(s){const was=this.settings.source;Object.assign(this.settings,s);if(was==='OFF'&&this.settings.source!=='OFF')this.gain=0;if(this.settings.source==='OFF'){this.offset.fill(0);this.gain=1}this.alpha=1-Math.exp(-1/(this.sr*this.settings.response));this.fastAlpha=1-Math.exp(-1/(this.sr*.012));this.slowAlpha=1-Math.exp(-1/(this.sr*.25));this.gainAttack=1-Math.exp(-1/(this.sr*.045));this.gainRelease=1-Math.exp(-1/(this.sr*Math.max(.06,this.settings.response)));this.lowAlpha=1-Math.exp(-2*Math.PI*160/this.sr);this.midAlpha=1-Math.exp(-2*Math.PI*2100/this.sr)}
 get active(){return this.settings.source!=='OFF'}
 get character(){return this.settings.character==='AUTO'?this.role==='drone'?'DRONE':this.role==='percussion'?'GROOVE':this.role==='bass'?'PULSE':'TEXTURE':this.settings.character}
 tick(l,r,midi,frame,beat=null){
  const s=this.settings;this.event=false;if(!this.active)return;
  let activity=0,pitch=.5,bright=.4,onset=false;
  if(s.source==='AUDIO'){
   const power=(l*l+r*r)*.5;this.fast+=(power-this.fast)*this.fastAlpha;this.slow+=(power-this.slow)*this.slowAlpha;
   for(let c=0;c<2;c++){const x=c?r:l;this.low[c]+=(x-this.low[c])*this.lowAlpha;this.mid[c]+=(x-this.mid[c])*this.midAlpha}
   const lo=(this.low[0]**2+this.low[1]**2)*.5,hi=((l-this.mid[0])**2+(r-this.mid[1])**2)*.5;
   this.energy+=(power-this.energy)*this.alpha;this.lowEnergy+=(lo-this.lowEnergy)*this.alpha;this.highEnergy+=(hi-this.highEnergy)*this.alpha;
   // Stable positive crossings of the low band provide a tentative bass fundamental.
   // Reject sporadic zero-crossings in broadband percussion; never claim exact key detection.
   const lowSignal=(this.low[0]+this.low[1])*.5;
   if(this.prevLow<=0&&lowSignal>0&&this.fast>.00001){const duration=frame-this.lastCross;const hz=this.sr/duration;
    if(hz>=38&&hz<=190){const stable=this.tonalHz>0&&Math.abs(Math.log2(hz/this.tonalHz))<.1;
     this.tonalConfidence=stable?Math.min(1,this.tonalConfidence+.15):Math.max(0,this.tonalConfidence-.22);
     this.tonalHz=stable?this.tonalHz*.85+hz*.15:hz;
    }else this.tonalConfidence*=.82;
    this.lastCross=frame;
   }
   this.prevLow=lowSignal;
   activity=clamp(Math.sqrt(this.fast)*2.8);bright=clamp(Math.sqrt(this.highEnergy/(this.energy+1e-8))*.65);
   pitch=clamp(.34+bright*.35-.18*clamp(this.lowEnergy/(this.energy+1e-8)));
   if(this.tonalConfidence>.5)pitch=clamp((69+12*Math.log2(this.tonalHz/440))/127);
   onset=frame-this.lastOnsetFrame>this.sr*.09&&this.fast>.000012&&this.fast>this.slow*1.72&&this.fast>this.energy*1.35;
  }else{
   const v=midi.sources,enabled=midi.settings.enabled,count=midi.noteOnCount;
   onset=enabled&&count!==this.lastMidiCount;this.lastMidiCount=count;
   activity=enabled?clamp(v.gate*(.23+.67*v.velocity)+v.density*.25):0;
   pitch=clamp(v.pitch);bright=clamp(v.velocity*.55+v.polyphony*.25+.12);
  }
  this.level+=(activity-this.level)*this.alpha;this.brightness+=(bright-this.brightness)*this.alpha;this.pitch+=(pitch-this.pitch)*this.alpha;
  this.gain+=(this.level-this.gain)*(activity>.008?this.gainAttack:this.gainRelease);
  const character=this.character;let pulse=false,step=-1;
  if(beat!==null&&Number.isFinite(beat)){step=Math.floor(beat*4+1e-7);if(step!==this.lastStep&&step>=0){pulse=true;this.lastStep=step}}
  else{this.phase+=s.density/this.sr;if(this.phase>=1){this.phase%=1;pulse=true}}
  if(onset)this.lastOnsetFrame=frame;
  let fire=false;
  // MIDI note-ons arrive before the envelope follower has risen: let the
  // exact onset through without waiting for its attack time.
  if(s.source==='MIDI'&&onset&&activity>.012&&character!=='GROOVE')fire=true;
  if(this.level>.012){
   if(onset&&character!=='DRONE'&&character!=='GROOVE'&&frame-this.lastEventFrame>this.sr*.085)fire=true;
   if(onset&&character==='DRONE'&&frame-this.lastEventFrame>this.sr*.8)fire=true;
   if(pulse){const barStep=((step%16)+16)%16,gridRate=beat!==null?Math.max(1,this.estimatedBpm)/60*4:s.density,cap=beat!==null?clamp(s.density/gridRate):1;
    const chance=character==='DRONE'?.016:character==='TEXTURE'?.14:character==='PULSE'?.47:character==='GROOVE'?(barStep%4===0?.85:barStep%4===2?.6:.23):.52;
    if(this.random()<chance*cap*(character==='GLITCH'&&barStep>=12?1.65:1)*(character==='GROOVE'&&barStep%4===0?1.2:1))fire=true;
   }
  }
  if(fire&&frame-this.lastEventFrame>this.sr*(character==='GLITCH'?.028:character==='DRONE'?.8:.075)){
   this.event=true;this.lastEventFrame=frame;this.drift=(this.random()*2-1)*s.variation;
   this.pad=character==='GROOVE'?(step%4===2?2:step%4===0?0:1):Math.floor(this.random()*3);
   this.velocity=clamp(.18+this.level*.62+(onset?.17:0),.08,.85);
  }
  this.motion+=(this.drift-this.motion)*this.alpha;
  if(frame%32===0){const d=s.depth,intensity=this.level;this.offset.fill(0);
   if(this.role==='percussion'||this.role==='bass'){
    this.offset[1]=(this.pitch-.5)*d*.085;this.offset[2]=(intensity-.4)*d*.1;this.offset[3]=(this.brightness-.5)*d*.11;
    this.offset[4]=(intensity-.5)*d*.12;this.offset[5]=(this.brightness-.5)*d*.15;this.offset[6]=this.motion*d*.09;this.offset[7]=this.motion*d*.12;
   }else{
    this.offset[0]=(this.pitch-.5)*d*.1;this.offset[1]=this.motion*d*.13;this.offset[2]=(this.brightness-.5)*d*.11;
    this.offset[3]=(intensity-.5)*d*.12;this.offset[4]=this.motion*d*.1;this.offset[5]=(this.brightness-.5)*d*.15;
    this.offset[6]=this.motion*d*.12;this.offset[7]=(intensity-.5)*d*.1;
   }
  }
 }
}
