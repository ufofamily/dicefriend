// Genre families share the audio clock, not their bass patterns or kick shaping.
const TAU=Math.PI*2,NOTES=[0,0,0,3,5,7,12,-12],RATIOS=[1,2.003,2.997,4.011];
export class HardDSP {
 constructor(sr,os,seed){this.sr=sr;this.os=os;this.phases=new Float64Array(4);this.pattern=new Int8Array(32);this.l=this.r=0;this.reset(seed)}
 random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296}
 reset(seed){this.seed=seed>>>0||1;for(let i=0;i<32;i++)this.pattern[i]=NOTES[Math.floor(this.random()*NOTES.length)];this.phases.fill(0);this.step=-1;this.lastGridStep=null;this.untilStep=0;this.elapsed=0;this.kickPhase=this.bassPhase=0;this.kickAge=this.bassAge=this.hatAge=100;this.kickAmp=this.bassAmp=this.texture=this.drone=0;this.pendingHat=-1;this.subAge=100;this.filter=0;this.note=0;this.kickCount=this.bassCount=0}
 silence(){this.kickAmp=this.bassAmp=this.texture=this.drone=0;this.kickAge=this.bassAge=this.hatAge=100}
 trigger(pad,pressure){if(pad===0){this.kickAge=0;this.kickPhase=0;this.kickAmp=pressure;this.kickCount++}if(pad===1){this.bassAge=0;this.bassAmp=pressure;this.bassCount++}if(pad===2)this.texture=Math.max(this.texture,pressure)}
 sample(p,pads,held,autonomous,gridStep=null){
 const sr=this.sr,dt=1/sr,beat=60/p[0],stepTime=beat/4,hyper=this.os===10,tek=this.os===11,ritual=this.os===12;
 this.elapsed+=dt;this.untilStep-=dt;
 if(gridStep!==null?gridStep!==this.lastGridStep:this.untilStep<=0){
  this.untilStep=gridStep!==null?stepTime:this.untilStep+stepTime;this.step=gridStep!==null?((gridStep%32)+32)%32:(this.step+1)%32;
  const beatStart=this.step%4===0,kickEnabled=autonomous||pads[0]>0,bassEnabled=autonomous||pads[1]>0;
  if(kickEnabled&&(beatStart||((hyper||this.os===9)&&this.step>=28&&p[6]>.2&&this.random()<p[6]*(hyper?.55:.25))))this.trigger(0,autonomous?.8:pads[0]);
  const bassStep=tek?this.step%4===2:ritual?this.step%4!==0:this.step%8===6;
  if(bassEnabled&&bassStep){this.trigger(1,autonomous?.75:pads[1]);this.note=this.pattern[this.step];if(ritual&&this.random()<p[7])this.note+=this.random()<.5?1:7}
  this.subAge=stepTime/2;
  if(!ritual&&this.step%2===1&&(autonomous||pads[2]>0))this.pendingHat=tek?p[6]*stepTime:0;
  if(this.step%16===0&&(autonomous||pads[2]>0))this.texture=.5;
 }
 this.lastGridStep=gridStep;
 // A second bass event halfway through eligible sixteenths gives the ritual 32nd-note roll.
 if(ritual&&this.subAge>=0){this.subAge-=dt;if(this.subAge<0&&this.step%4!==0&&(autonomous||pads[1]>0))this.trigger(1,autonomous?.55:pads[1])}
 if(this.pendingHat>=0){this.pendingHat-=dt;if(this.pendingHat<0)this.hatAge=0}
 const age=this.kickAge,tail=Math.min(p[2],beat*(hyper?3:1.1));
 const sweep=Math.exp(-age/(ritual?.007:tek?.014:.012));
 this.kickPhase=(this.kickPhase+Math.min(5200,sr*.24,p[1]*2**(p[3]*sweep))*dt)%1;
 const raw=Math.sin(TAU*this.kickPhase),colour=p[5];
 let kick=ritual?raw:Math.tanh((raw+Math.sin(TAU*this.kickPhase*3)*colour*.3)*(1+colour*7))/(1+colour*.35);
 kick*=Math.exp(-age/tail)*Math.min(1,age/.0005)*this.kickAmp;
 const duck=1-.9*Math.exp(-age/(beat*.15));
 this.bassPhase=(this.bassPhase+p[1]*2**(this.note/12)*dt)%1;const phase=TAU*this.bassPhase;
 const bassDecay=ritual?stepTime*.28:tek?beat*.23:beat*.15;
 const bassEnv=Math.exp(-this.bassAge/Math.max(.001,bassDecay))*Math.min(1,this.bassAge/.0008)*this.bassAmp;
 const bassWave=ritual?Math.sin(phase+Math.sin(phase*2)*colour*5):Math.sin(phase)+Math.sin(phase*2)*colour*.45+Math.sin(phase*3)*colour*.25;
 this.filter+=(bassWave-this.filter)*(1-Math.exp(-TAU*(150+colour*2800)/sr));
 let mono=kick*(ritual?.48:.6)+this.filter*bassEnv*p[4]*duck*.32;
 let upperL=0,upperR=0;
 if(!ritual){const hat=(this.random()*2-1)*Math.exp(-this.hatAge/.014)*p[7]*.055;upperL+=hat;upperR+=hat*(1-p[9]*.6)}
 const desired=autonomous?1:Math.min(1,pads[1]+pads[2]);
 this.drone+=(desired-this.drone)*(desired>this.drone?dt/.8:dt/.9);
 if(ritual){for(let j=0;j<4;j++){const ratio=RATIOS[j];this.phases[j]=(this.phases[j]+p[1]*ratio*dt)%1;const tone=Math.sin(TAU*this.phases[j]+Math.sin(this.elapsed*(.07+j*.013))*colour)*this.drone*p[6]*.035/(1+j*.25);upperL+=tone*(1-(j%2)*p[9]*.7);upperR+=tone*(1-((j+1)%2)*p[9]*.7)}}
 else {const gate=autonomous?1:Math.min(1,pads[2]+this.texture);const stab=Math.sin(phase*4+Math.sin(phase)*colour*3)*this.texture*gate*.045;upperL+=stab;upperR+=Math.sin(phase*4+.4*p[9])*this.texture*gate*.045}
 this.texture*=Math.exp(-dt/(ritual?1.5:.1));this.kickAge+=dt;this.bassAge+=dt;this.hatAge+=dt;
 this.l=mono+upperL;this.r=mono+upperR;
 }
}
