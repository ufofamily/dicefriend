// Offline equivalent of the live one-hop PeerBus. Events are forwarded after
// each 128-sample block, so generated WAVs preserve inter-preset interaction.
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class OfflinePeerRouter {
 constructor(sr){this.sr=sr;this.lastSent=new Map();this.lastReceived=new Map();this.count=0}
 route(voices,frame){
  const now=frame/this.sr;
  const emitted=voices.map(v=>{const event=v.core.outboundEvent;v.core.outboundEvent=null;return event});
  for(let i=0;i<voices.length;i++){
   const sender=voices[i],cfg=sender.preset.generative,event=emitted[i];
   if(!event||cfg?.source!=='PEER'||!(cfg.send>0))continue;
   const rate=Math.min(10,Math.max(.7,cfg.density*(.15+.35*clamp(cfg.send))));
   if(now-(this.lastSent.get(i)??-1e9)<1/rate)continue;
   this.lastSent.set(i,now);
   for(let j=0;j<voices.length;j++){
    if(i===j)continue;
    const receiver=voices[j],target=receiver.preset.generative;
    if(target?.source!=='PEER'||!(target.receive>0))continue;
    if(target.receiveFrom!=='ALL'&&(!Array.isArray(target.receiveFrom)||!target.receiveFrom.includes(sender.preset.instanceId)))continue;
    const rateR=Math.min(12,Math.max(.5,target.density*(.2+.35*clamp(target.receive))));
    if(now-(this.lastReceived.get(j)??-1e9)<1/rateR)continue;
    const velocity=clamp(event.velocity*clamp(cfg.send)*clamp(target.receive)*1.65);
    if(velocity<.035)continue;
    this.lastReceived.set(j,now);
    receiver.core.receivePeer({pad:event.pad,velocity,brightness:.5,pitch:.5});
    this.count++;
   }
  }
 }
}
