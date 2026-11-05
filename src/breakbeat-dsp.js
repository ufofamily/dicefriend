const TAU=2*Math.PI;
// Sample-free two-step / tracker-style break synthesizer. Snare ghosts, variable
// hat articulation and phrase-end edit clusters are distinct from a 4/4 kick.
export class BreakbeatDSP{
 constructor(sr,os,seed){this.sr=sr;this.reset(seed)}
 reset(seed){this.seed=seed>>>0||1;this.step=-1;this.lastGridStep=null;this.untilStep=0;this.elapsed=0;
  this.kickTime=this.snareTime=this.hatTime=99;this.kickAmp=this.snareAmp=this.hatAmp=0;
  this.kickPhase=this.snarePhase=0;this.snareNoise=0;this.hatHP=0;this.l=this.r=0;
  this.kickCount=this.snareCount=this.hatCount=0;this.editCount=0;this.rollTime=0;this.rollLeft=0;this.rollType=0;this.rollLevel=0}
 rand(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296}
 silence(){this.kickAmp=this.snareAmp=this.hatAmp=0;this.rollLeft=0}
 trigger(pad,velocity){const a=Math.max(0,Math.min(1,velocity));if(pad===0){this.kickTime=0;this.kickAmp=a;this.kickCount++}else if(pad===1){this.snareTime=0;this.snareAmp=a;this.snareCount++}else{this.hatTime=0;this.hatAmp=a;this.hatCount++}}
 sample(p,pads,held,as,grid=null){
  const dt=1/this.sr,stepTime=60/p[0]/4,pressure=Math.max(...pads);this.untilStep-=dt;
  const changed=grid!==null?grid!==this.lastGridStep:this.untilStep<=0;
  if(changed){this.untilStep=grid!==null?stepTime:this.untilStep+stepTime*(1+(this.step%2===0?p[6]*.4:-p[6]*.4));this.step=grid!==null?((grid%64)+64)%64:(this.step+1)%64;
   const s=this.step%16,bar=(this.step/16)|0,hard=p[4],edit=p[5],playing=as||pressure>.01;
   const poly=(this.step+bar*3)%14; // seven-eighth cross-cycle against 4/4 backbeat
   if(playing){
    const kick=[0,6,10].includes(s)||(hard>.52&&this.rand()<hard*.34*edit)||(s===14&&this.rand()<edit*.2)||(hard>.55&&[0,9].includes(poly)&&this.rand()<hard*edit*.34);
    const snare=s===4||s===12||(s===15&&hard>.5&&this.rand()<edit*.45)||(hard>.6&&[4,11].includes(poly)&&this.rand()<edit*.42);
    if(kick)this.trigger(0,.74+(s===0?.2:0)*p[3]);
    if(snare)this.trigger(1,(s===4||s===12?.7:.45)+hard*.1);
    else if([3,7,11,15].includes(s)&&this.rand()<p[7]*(.4+hard*.45)+edit*.12)this.trigger(1,.12+.22*this.rand());
    if(s%2===0||this.rand()<.4+hard*.45+edit*.15)this.trigger(2,(s%4===2?.42:.25)+this.rand()*.08);
    if(hard>.35&&edit>.08&&(s>=12||s===7||s===15)&&this.rand()<edit*(hard*.7)){
     this.rollLeft=1+Math.floor(this.rand()*(hard>.7?5:3));this.rollTime=stepTime/(this.rollLeft+1);
     this.rollType=this.rand()<.75?1:2;this.rollLevel=.32+this.rand()*.32;this.editCount++;
    }
    // Shift every fourth bar: recurring pattern with a clear phrase rather than random noise.
    if(hard>.6&&bar===3&&s===15&&this.rand()<edit)this.trigger(0,.55);
   }
  }
  this.lastGridStep=grid;
  this.rollTime-=dt;if(this.rollLeft>0&&this.rollTime<=0){this.trigger(this.rollType,this.rollLevel);this.rollLeft--;this.rollTime+=stepTime/(this.rollLeft+2)}
  this.kickTime+=dt;this.snareTime+=dt;this.hatTime+=dt;
  const kt=this.kickTime,st=this.snareTime,ht=this.hatTime;
  const kEnv=Math.exp(-kt/(.055+p[2]*.14))*this.kickAmp;
  const kHz=p[1]*(1+4.2*Math.exp(-kt/.014));this.kickPhase=(this.kickPhase+kHz*dt)%1;
  const kick=Math.sin(TAU*this.kickPhase)*kEnv*.56;
  const snEnv=Math.exp(-st/(.038+p[2]*.11))*this.snareAmp;
  this.snarePhase=(this.snarePhase+(170+p[1]*.48)*dt)%1;
  const noise=this.rand()*2-1;
  this.snareNoise+=(noise-this.snareNoise)*.055;
  const snare=(Math.sin(TAU*this.snarePhase)*.24+(noise-this.snareNoise)*(.45+.15*p[3]))*snEnv;
  const hatEnv=Math.exp(-ht/(.009+.024*(1-p[3])))*this.hatAmp;
  this.hatHP+=(noise-this.hatHP)*.16;
  const hat=(noise-this.hatHP)*hatEnv*.12;
  const dry=kick+snare;
  this.l=dry+hat*(1-p[9]*.38);
  this.r=dry+hat*(1+p[9]*.38)+snare*p[9]*.05;
 }
}
