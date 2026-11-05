import {transportBeat,transportBpm} from './Transport.js';
import {glide,clamp} from './automation.js';
export const sampleDefaults={volume:.65,pan:0,rate:1,pitch:0,reverse:false,offset:0,loop:true,loopStart:0,loopEnd:0,filter:18000,stutter:0,grainSize:.08,density:0,fileBpm:120,mode:'INDEPENDENT',chaos:0,highpass:20,resonance:.7,drive:0,delayTime:.25,delayFeedback:.25,delayMix:0,attack:.02,release:.04,muted:false};
export class SampleProcessor{
 constructor(sr){this.sr=sr;this.channels=null;this.p={...sampleDefaults};this.rate=1;this.gate=0;this.position=0;this.playing=false;this.startAt=0;this.grains=Array.from({length:64},()=>({age:0,length:0,position:0}));this.untilGrain=0;this.grainMix=0;this.lastBeat=null;this.lastOut=[0,0];this.transition=0;this.chaos=0;this.chaosSmooth=0}
 load(channels){this.channels=channels;this.length=channels[0].length;this.position=0;this.playing=false;this.gate=0;this.grains.forEach(g=>g.length=0)}
 configure(p){if(['reverse','stutter','loopStart','loopEnd','loop'].some(k=>p[k]!==undefined&&p[k]!==this.p[k]))this.transition=1;Object.assign(this.p,p);if(this.length){this.p.loopStart=clamp(this.p.loopStart,0,(this.length-1)/this.sr);this.p.loopEnd=clamp(this.p.loopEnd||this.length/this.sr,this.p.loopStart+1/this.sr,this.length/this.sr)}}
 seek(seconds){this.transition=1;this.position=clamp(seconds*this.sr,0,Math.max(0,(this.length||1)-1));this.grains.forEach(g=>g.length=0)}
 read(ch,pos){if(!this.channels)return 0;const data=this.channels[ch]||this.channels[0];pos=clamp(pos,0,data.length-1);const i=Math.floor(pos),f=pos-i;return data[i]*(1-f)+(data[Math.min(i+1,data.length-1)]||0)*f}
 render(l,r,time){
  const p=this.p;if(!this.channels)return;
  const direction=p.reverse?-1:1;let baseRate=p.rate*2**(p.pitch/12);
  const start=p.loopStart*this.sr,end=p.loopEnd*this.sr;
  for(let i=0;i<l.length;i++){
   const sampleTime=time+i/this.sr;
   if(this.transport){if(p.mode==='FOLLOW'&&this.transport.tempoMap)baseRate=transportBpm(this.transport,sampleTime)/p.fileBpm*2**(p.pitch/12);const beat=transportBeat(this.transport,sampleTime);if(this.lastBeat!==null&&beat<this.lastBeat-.01){this.position=(p.reverse?p.loopEnd:p.offset)*this.sr;this.transition=1;this.grains.forEach(g=>g.length=0)}this.lastBeat=beat}
   const active=this.playing&&sampleTime>=this.startAt;this.gate+=(Number(active)-this.gate)*(1-Math.exp(-1/(this.sr*(active?p.attack:p.release))));
   this.chaosSmooth=glide(this.chaosSmooth,this.chaos,this.sr);this.rate=glide(this.rate,direction*baseRate*(1+this.chaosSmooth*p.chaos*.15),this.sr);
   if(!active&&this.gate<.00001)continue;
   let pos=this.position;
   if(p.stutter>0){const n=Math.max(32,p.stutter*this.sr);pos=start+((pos-start)%n+n)%n}
   let a=this.read(0,pos),b=this.read(1,pos);
   this.grainMix=glide(this.grainMix,p.density>0?1:0,this.sr);const dryA=a,dryB=b;
   if(p.density>0||this.grainMix>.0001){
    this.untilGrain--;if(this.untilGrain<=0){this.untilGrain=this.sr/Math.max(.1,p.density);const g=this.grains.find(g=>!g.length);if(g){g.position=pos;g.age=0;g.length=Math.max(32,p.grainSize*this.sr)}}
    a=0;b=0;
    for(const g of this.grains){if(!g.length)continue;const envelope=Math.sin(Math.PI*g.age/g.length)**2;const at=g.position+g.age*this.rate;a+=this.read(0,at)*envelope;b+=this.read(1,at)*envelope;if(++g.age>=g.length)g.length=0}
    const norm=Math.max(1,p.density*p.grainSize*.5);a=dryA*(1-this.grainMix)+a/norm*this.grainMix;b=dryB*(1-this.grainMix)+b/norm*this.grainMix;
   }
   let edge=1;if(p.loop){const fade=Math.min(this.sr*.005,(end-start)/4);edge=Math.min(1,Math.max(0,(pos-start)/fade),Math.max(0,(end-pos)/fade))}
   const cross=this.transition;this.transition*=Math.exp(-1/(this.sr*.01));l[i]=a*this.gate*edge*(1-cross)+this.lastOut[0]*cross;r[i]=b*this.gate*edge*(1-cross)+this.lastOut[1]*cross;this.lastOut[0]=l[i];this.lastOut[1]=r[i];
   if(active)this.position+=this.rate;
   if(p.loop&&(this.position>=end||this.position<start)){const span=Math.max(1,end-start);this.position=start+((this.position-start)%span+span)%span}
   else if(this.position>=this.length||this.position<0){this.position=clamp(this.position,0,this.length-1);this.playing=false}
  }
 }
}
