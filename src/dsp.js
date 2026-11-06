import {FrequencyFilter} from './generative/FrequencyFilter.js';
import {OutputConditioner} from './audio/OutputConditioner.js';
import {Generator} from './generative/Generator.js';
import {SlambientDSP} from './slambient-dsp.js';
import {ambientClasses} from './ambient-dsp.js';
import {MidiControl} from './midi/MidiControl.js';
import {HardDSP} from './hard-dsp.js';
import {transportBeat,transportBpm} from './audio/Transport.js';
import {BassDSP} from './bass-dsp.js';
import {BreakbeatDSP} from './breakbeat-dsp.js';
import {systems,fromNorm,defaults,engineRegistry,midiDefaults} from './parameters.js';
const TAU=Math.PI*2;
export class SynthCore {
 constructor(sr,os=0,seed=1){this.sr=sr;this.frequencyFilter=new FrequencyFilter(sr);this.conditioner=new OutputConditioner(sr,os);this.generator=new Generator(sr,seed,engineRegistry[os].routingRole);this.os=os;this.cap=engineRegistry[os];this.midi=new MidiControl(sr,midiDefaults(os));this.midi.settings.enabled=false;this.midi.onNote=v=>this.midiExcite(v);this.midiGrainIndex=0;this.ambient=ambientClasses[this.cap.id]?new ambientClasses[this.cap.id](sr,seed):null;this.target=defaults(os);this.n=this.target.slice();this.p=new Float64Array(12);this.pads=new Float64Array(3);this.held=new Float64Array(3);this.phase=new Float64Array(4);this.mode='AS';this.voices=Array.from({length:64},()=>({age:0,len:0,f:0,pan:0,amp:0,kind:0}));this.modes=Array.from({length:12},()=>({y:0,z:0}));this.delayL=new Float32Array(sr*2);this.delayR=new Float32Array(sr*2);this.revL=new Float32Array(Math.floor(sr*.137));this.revR=new Float32Array(Math.floor(sr*.173));this.di=0;this.ri=0;this.filter=new Float64Array(4);this.dc=new Float64Array(4);this.dcPole=this.cap.dspType!=='legacy'?Math.exp(-2*Math.PI*5/sr):.995;this.env=0;this.tick=0;this.counter=0;this.outboundEvent=null;this.bass=this.cap.dspType==='slambient'?new SlambientDSP(sr,os,seed):this.cap.dspType==='hard'?new HardDSP(sr,os,seed):this.cap.dspType==='bass'?new BassDSP(sr,os,seed):this.cap.dspType==='rhythm'?new BreakbeatDSP(sr,os,seed):null;for(let j=0;j<12;j++)this.p[j]=fromNorm(systems[os].params[j],this.n[j]);this.randomize(seed)}
 randomize(seed){this.generator.reset(seed);this.bass?.reset(seed);this.ambient?.reset(seed);this.seed=seed>>>0||1;this.reg=(this.rand()*255)|1;this.x=.1+this.rand();this.y=.2;this.z=.3;this.tick=0;this.env=0;this.phase.fill(0);this.voices.forEach(v=>v.len=0);this.modes.forEach(v=>{v.y=0;v.z=0})}
 rand(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296}
 setParameter(i,v){if(i>=0&&i<12&&Number.isFinite(v)){this.target[i]=Math.max(0,Math.min(1,v));if(this.counter===0){this.n[i]=this.target[i];this.p[i]=fromNorm(systems[this.os].params[i],this.n[i])}}}
 setMode(m){this.mode=m;this.bass?.silence();this.ambient?.silence();this.pads.fill(0);this.held.fill(0)}
 receivePeer(event){return this.generator.receivePeer(event)}
 touch(i,p,a){if(i<0||i>2)return;const was=this.pads[i]>0;this.pads[i]=a?Math.max(.05,Math.min(1,p)):0;if(a&&!was){this.held[i]=0;this.excite(i,p)}}
 excite(i=0,amp=1,external=false){if(!external)this.outboundEvent={pad:i,velocity:Math.min(1,Math.max(0,amp))};if(this.ambient){this.ambient.trigger(i,amp);return}if(this.bass){this.bass.trigger(i,amp);return}this.env=Math.max(this.env,amp);if(this.os===2){for(let j=0;j<12;j++){this.modes[j].y+=(this.rand()*2-1)*amp*.16/(1+j*.25)*(1-this.p[6]*8)*Math.cos((i+1)*(j+1)*.7)}}else if(this.os===1||this.os===4){this.grain(i,amp)}}
 grain(pad,amp){const p=this.p;let v=null;for(let j=0;j<64;j++){if(this.voices[j].len===0){v=this.voices[j];break}}if(!v)return;v.age=0;v.len=Math.max(4,Math.floor((this.os===1?p[2]:p[1])*this.sr));v.f=(this.os===1?p[1]:p[0])*2**(pad/3+(this.rand()-.5)*(this.os===1?p[5]*3:p[7]*2));v.pan=(this.rand()*2-1)*p[9];v.amp=amp;v.kind=this.rand();v.midiVoice=null;if(this.os===4){v.f*=2**((this.rand()-.5)*p[4]*2+Math.sin(this.counter/this.sr*p[6])*.15);v.len=Math.max(4,Math.floor(v.len*(1+(this.rand()-.5)*p[3]))) }return v}
 midiExcite(v){if(this.generator.active||this.midi.settings.mode==='MODULATION')return;if(this.ambient){this.ambient.trigger(0,v.velocity);return}const index=this.bass?1:this.os===1?1:0,base=this.p[index];this.p[index]=base*(1-this.midi.settings.pitchTracking)+v.frequency*this.midi.settings.pitchTracking;const velocity=(1-this.midi.settings.velocitySensitivity+v.velocity*this.midi.settings.velocitySensitivity)*this.midi.settings.intensity*this.midi.settings.balance*this.midi.excitation;if(this.bass)this.bass.trigger(v.channel===9?(v.note===35||v.note===36?0:2):1,velocity);else if(this.os===1||this.os===4){const grain=this.grain(0,velocity);if(grain){grain.midiVoice=v;grain.ratio=grain.f/v.frequency}}this.p[index]=base}
 setMidiMode(mode){this.midi.configure({enabled:true,mode})}
 setMidiModulation(settings){this.requestedMidi={...this.requestedMidi,...settings};this.midi.configure({...this.requestedMidi,...(this.generator.active?{mode:'MODULATION',matrix:[]}: {})})}
 setExtensions(s){this.frequencyFilter.configure(s.frequencyFilter||{});this.generator.configure(s.generative||{});if(this.requestedMidi)this.setMidiModulation({})}
 enqueueMidi(events){this.midi.enqueue(events)}
 noteOn(note,velocity,channel=0,frame=this.counter){this.enqueueMidi([{type:'on',note,velocity,channel,frame}])}
 noteOff(note,channel=0,frame=this.counter){this.enqueueMidi([{type:'off',note,channel,frame}])}
 controlChange(cc,value,channel=0,frame=this.counter){this.enqueueMidi([{type:'cc',cc,value,channel,frame}])}
 pitchBend(value,channel=0,frame=this.counter){this.enqueueMidi([{type:'bend',value,channel,frame}])}
 aftertouch(value,channel=0,frame=this.counter){this.enqueueMidi([{type:'aftertouch',value,channel,frame}])}
 allNotesOff(){this.midi.clear()}
 panic(){this.midi.clear(true);this.bass?.silence();this.pads.fill(0)}
 render(left,right,frame=this.counter,inputL=null,inputR=inputL){for(let j=0;j<12;j++){this.n[j]+=(this.target[j]-this.n[j])*.025;this.p[j]=fromNorm(systems[this.os].params[j],this.n[j])}const p=this.p,sr=this.sr;
 const transport=this.transport;if(transport&&this.bass)p[0]=transport.bpm;
 for(let k=0;k<left.length;k++){
 if(frame+k<(this.startFrame||0)){left[k]=right[k]=0;continue}
 let gridStep=null;this.midi.tick(frame+k,this.transport?transportBeat(this.transport,(frame+k)/sr):(frame+k)/sr*2);
 this.generator.estimatedBpm=this.transport?.bpm||(this.bass?p[0]:120);
 this.generator.tick(inputL?.[k]||0,inputR?.[k]||0,this.midi,frame+k,this.transport?transportBeat(this.transport,(frame+k)/sr):null);
 if(this.generator.event&&this.cap.dspType!=='rhythm')this.excite(this.generator.pad,this.generator.velocity,this.generator.settings.source==='PEER');
 if((frame+k)%32===0&&(this.midi.settings.enabled||this.generator.active)){for(let j=0;j<12;j++)this.p[j]=fromNorm(systems[this.os].params[j],Math.max(0,Math.min(1,this.n[j]+(this.generator.active?this.generator.offset[j]:this.midi.settings.mode==='NOTE'?0:this.midi.offset[j]))));if(this.transport&&this.bass)this.p[0]=this.transport.bpm}
 if(this.os===22&&this.generator.settings.source==='MIDI'&&this.midi.sources.gate>0){const note=this.generator.pitch*127;this.p[0]=Math.max(45,Math.min(620,440*2**((note-69)/12)));}
 if(this.os===22&&this.generator.settings.source==='AUDIO'&&this.generator.tonalConfidence>.65){let root=this.generator.tonalHz;const reference=p[0];while(root<reference*.7071)root*=2;while(root>reference*1.4142)root/=2;this.p[0]=Math.max(45,Math.min(620,root));}
 if(transport){if(this.bass)p[0]=transportBpm(transport,(frame+k)/sr);const time=(frame+k)/sr;const beat=transport.at===undefined?(frame+k-transport.origin)/sr*transport.bpm/60:transportBeat(transport,time);const pulse=beat*4,index=Math.floor(pulse+1e-8);gridStep=this.cap.dspType==='rhythm'?Math.floor(pulse-(index%2?p[6]*.45:0)+1e-8):index;if(beat<0||(transport.at!==undefined&&(!transport.running||time<transport.at))){left[k]=right[k]=0;continue}}
 let count=0,pressure=0,pitch=1;for(let j=0;j<3;j++)if(this.pads[j]){count++;pressure+=this.pads[j];this.held[j]+=1/sr;pitch+=j*.18+Math.min(2,this.held[j])*.015}pressure=Math.min(1,pressure/Math.max(1,count));
 const autonomous=this.generator.active||this.mode==='AS'&&!(this.midi.settings.enabled&&this.midi.settings.mode==='NOTE');let rate=this.os===0?p[6]:this.os===1?p[0]:this.os===2?p[4]:this.os===3?p[6]:p[2];
 if(this.os===3)rate*=.5+Math.abs(Math.tanh(this.y/15));this.tick-=1/sr;if(this.cap.dspType==='legacy'&&(transport?gridStep!==this.lastGridStep:this.tick<=0)){this.tick=(this.os===4?1+(this.rand()-.5)*p[3]*1.8:.45+this.rand())/rate;if(autonomous&&this.rand()>(this.os===1?Math.min(.99,p[7]+(1-p[3])*.8):.12))this.excite((this.reg>>2)%3,.4+this.rand()*.6);if(!autonomous&&count&&(this.os===1||this.os===4))this.grain((this.reg>>1)%3,pressure);this.reg=((this.reg<<1)|(((this.reg>>7)^(this.reg>>5)^(this.rand()>.6?1:0))&1))&255}
 if(this.midi.settings.enabled&&this.midi.settings.mode!=='MODULATION'&&(this.os===1||this.os===4)&&this.tick<1/sr){for(let j=0;j<6;j++){const v=this.midi.voices[(this.midiGrainIndex+j)%6];if(v.gate||v.pedal){this.midiExcite(v);this.midiGrainIndex=(this.midiGrainIndex+j+1)%6;break}}}
 this.lastGridStep=gridStep;
 let l=0,r=0;const gate=autonomous?1:Math.min(1,count*.45);this.env*=Math.exp(-1/(sr*.18));
 if(this.ambient){this.ambient.sample(p,this.pads,this.held,autonomous,this.midi);l=this.ambient.l;r=this.ambient.r}
 else if(this.bass){let midiGate=0;for(const v of this.midi.voices)midiGate+=v.env*v.velocity;this.bass.midiGate=this.midi.settings.enabled&&this.midi.settings.mode!=='MODULATION'?Math.min(1,midiGate):0;const root=p[1];if(this.bass.midiGate>1e-6){let voice=this.midi.voices[0];for(const v of this.midi.voices)if(v.serial>voice.serial)voice=v;p[1]=root*(1-this.midi.settings.pitchTracking)+voice.frequency*this.midi.settings.pitchTracking}this.bass.sample(p,this.pads,this.held,autonomous,gridStep);if(this.bass.selfEvent){this.outboundEvent=this.bass.selfEvent;this.bass.selfEvent=null;}l=this.bass.l;r=this.bass.r;p[1]=root}
 else if(this.os===0){const step=this.reg/255;const a=this.phase[0],b=this.phase[1];this.phase[0]=(a+p[0]*pitch*(1+p[2]*Math.sin(TAU*b)*2+step*p[3]*4)/sr+1)%1;this.phase[1]=(b+p[1]*(1+p[2]*(a>.5?1:-.5))/sr+1)%1;if(a>this.phase[0])this.reg=((this.reg<<1)|(((this.reg>>7)^(this.reg>>4)^(b>.5?1:0))&1))&255;const v=(Math.sin(TAU*a)*(1-p[7])+(step*2-1)*p[7])*(.22+this.env*.6)*gate;l=v;r=v*(1-p[9]*.45)+Math.sin(TAU*b)*p[9]*.2*gate}
 else if(this.os===1||this.os===4){for(let j=0;j<64;j++){const v=this.voices[j];if(!v.len)continue;const t=v.age/v.len;const e=this.os===1?Math.sin(Math.PI*t)**p[4]:.5-.5*Math.cos(TAU*t);const ph=TAU*(v.midiVoice?v.midiVoice.frequency*v.ratio:v.f)*v.age/sr*(this.os===1?1+.1*Math.sin(this.counter/sr*p[6]):1);const wave=this.os===1?Math.sin(ph):Math.sin(ph)*(1-p[5])+(Math.sin(ph*.503)+Math.sin(ph*1.997))*.35*p[5];const s=wave*e*v.amp*.13*(v.midiVoice?v.midiVoice.env*this.midi.settings.intensity:1);l+=s*Math.sqrt((1-v.pan)*.5);r+=s*Math.sqrt((1+v.pan)*.5);if(++v.age>=v.len)v.len=0}if(!autonomous&&!count){l*=.98;r*=.98}}
 else if(this.os===2){for(let j=0;j<12;j++){const m=this.modes[j];const ratio=(j+1)*(1+p[5]*j*.075+p[2]*Math.sin(j*2.3)*.11);const freq=Math.min(sr*.42,p[0]*ratio*pitch*(1+p[7]*Math.sin(this.counter/sr*.7)*.04));const decay=Math.exp(-1/(sr*p[1]/(1+j*.12)));const next=2*decay*Math.cos(TAU*freq/sr)*m.y-decay*decay*m.z;m.z=m.y;m.y=next;const s=next*(.02+p[3]*j*.006);l+=s*(j%2?1-p[9]*.6:1);r+=s*(j%2?1:1-p[9]*.6)}}
 else {const dt=.00005*p[3];const dx=p[2]*(this.y-this.x),dy=this.x*(p[1]-this.z)-this.y,dz=this.x*this.y-2.6666667*this.z;this.x+=dx*dt;this.y+=dy*dt;this.z+=dz*dt;if(!Number.isFinite(this.x)||Math.abs(this.x)>100){this.x=.1;this.y=.2;this.z=.3}this.phase[0]=(this.phase[0]+p[0]*pitch*2**(Math.tanh(this.x/15)*p[7]*2)/sr)%1;this.phase[1]=(this.phase[1]+p[0]*1.007/sr)%1;const s=(Math.sin(TAU*this.phase[0])*.22+Math.tanh(this.y/15)*.12)*gate*(.3+this.env);const pan=Math.tanh(this.x/12)*p[9];l=s*(1-pan*.7);r=s*(1+pan*.7)}
 if(this.os===0||this.os===3){const cut=Math.min(sr*.38,p[4]*(this.os===3?1+.6*Math.tanh(this.z/30):1));// Stable topology-preserving SVF. Recalculate coefficients at control
 // rate rather than calling tan() 48,000 times per second per voice.
 if((this.counter&31)===0||!this.legacySVFA){
  this.legacySVFG=Math.tan(Math.PI*cut/sr);
  this.legacySVFK=1.9-p[5]*1.75;
  this.legacySVFA=1/(1+this.legacySVFG*(this.legacySVFG+this.legacySVFK));
 }
 const g=this.legacySVFG,k=this.legacySVFK,a=this.legacySVFA;
 for(let ch=0;ch<2;ch++){const offset=ch*2,s1=this.filter[offset],s2=this.filter[offset+1];
 const input=Math.tanh(ch?r:l),v3=input-s2,v1=a*(s1+g*v3),v2=s2+g*v1;
 this.filter[offset]=Math.max(-6,Math.min(6,2*v1-s1));
 this.filter[offset+1]=Math.max(-6,Math.min(6,2*v2-s2));
 if(ch)r=v2;else l=v2}}
 if(!this.ambient&&this.midi.settings.enabled&&this.midi.settings.mode!=='MODULATION'&&(this.os===0||this.os===3)){for(const v of this.midi.voices){if(v.env<1e-8)continue;v.phase=(v.phase+v.frequency/sr)%1;v.phase2=(v.phase2+v.frequency*1.003/sr)%1;const z=this.os===0?Math.tanh((2*v.phase-1)*(1+p[2]*4)):Math.sin(TAU*v.phase+Math.sin(TAU*v.phase2)*p[7]*4);const amp=v.env*v.velocity*this.midi.settings.intensity*this.midi.settings.balance*.09;l+=z*amp;r+=z*amp*(1-p[9]*.3)}}
 if(this.os===2&&this.midi.settings.enabled&&this.midi.settings.mode!=='MODULATION'){for(const v of this.midi.voices){for(let j=0;j<8;j++){const ratio=(j+1)*(1+p[5]*j*.075+p[2]*Math.sin(j*2.3)*.11),frequency=Math.min(sr*.42,v.frequency*ratio*this.midi.frequency),decay=Math.exp(-1/(sr*p[1]/(1+j*.12)));const y=2*decay*Math.cos(TAU*frequency/sr)*v.resY[j]-decay*decay*v.resZ[j]+v.strike*(1-decay)*.4/(1+j);v.resZ[j]=v.resY[j];v.resY[j]=y;const z=y*v.env*(.3+p[3])*this.midi.settings.intensity;l+=z*(j%2?1-p[9]*.5:1);r+=z*(j%2?1:1-p[9]*.5)}v.strike*=.94}}
 if(this.midi.settings.enabled){l*=this.midi.amplitude*(1-this.midi.stereo*.5);r*=this.midi.amplitude*(1+this.midi.stereo*.5)}
 const drive=p[8];l=Math.tanh(l*drive);r=Math.tanh(r*drive);const read=(this.di+this.delayL.length-Math.floor(sr*.327))%this.delayL.length;const dl=this.delayL[read],dr=this.delayR[read];this.delayL[this.di]=Math.tanh(l+dr*p[10]*.8);this.delayR[this.di]=Math.tanh(r+dl*p[10]*.8);this.di=(this.di+1)%this.delayL.length;l+=dl*p[10]*.6;r+=dr*p[10]*.6;
 const a=this.ri%this.revL.length,b=this.ri%this.revR.length,rl=this.revL[a],rr=this.revR[b];this.revL[a]=Math.tanh(l*.3+rr*.68);this.revR[b]=Math.tanh(r*.3+rl*.71);this.ri++;l+=rl*p[11];r+=rr*p[11];for(let ch=0;ch<2;ch++){const v=this.frequencyFilter.process((ch?r:l)*(this.generator.active?this.generator.gain:1),ch),off=ch*2;const y=v-this.dc[off]+this.dcPole*this.dc[off+1];this.dc[off]=v;this.dc[off+1]=y;const out=Number.isFinite(y)?Math.tanh(y*.7)*.85:0;if(ch)right[k]=out;else left[k]=out}this.counter++;
 }
 this.conditioner.process(left,right);
 }
}
