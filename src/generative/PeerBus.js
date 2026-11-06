// In-browser event bus for interaction between independent AudioWorklets.
// One hop only: receivers may sound, but received impulses are not rebroadcast.
// No audio signal is routed between worklets; event budgets protect CPU and ears.
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export class PeerBus {
 constructor(){this.voices=new Set();this.lastSend=new WeakMap();this.lastReceive=new WeakMap();this.counters=new WeakMap();this.onActivity=null}
 register(voice){this.voices.add(voice);this.counters.set(voice,{sent:0,received:0})}
 unregister(voice){this.voices.delete(voice)}
 onEvent(sender,event){
  const config=sender.peerConfig;
  if(!sender.playing||!config||config.source!=='PEER'||clamp(config.send)<=0)return;
  const now=sender.context?.currentTime||0,old=this.lastSend.get(sender)??-1e10;
  // Sender rate depends on its density control; never more than ~10 Hz.
  const rate=Math.min(10,Math.max(.7,config.density*(.15+.35*clamp(config.send))));
  if(now-old<1/rate)return;
  this.lastSend.set(sender,now);
  const stats=this.counters.get(sender);if(stats)stats.sent++;
  for(const receiver of this.voices){
   if(receiver===sender||receiver.peerId===sender.peerId||!receiver.playing||!receiver.node||receiver.context!==sender.context)continue;
   const cfg=receiver.peerConfig;
   if(!cfg||cfg.source!=='PEER'||clamp(cfg.receive)<=0)continue;
   if(cfg.receiveFrom!=='ALL'&&(!Array.isArray(cfg.receiveFrom)||!cfg.receiveFrom.includes(sender.peerId)))continue;
   // Receiver has its own refractory interval, independent of how many layers send.
   const last=this.lastReceive.get(receiver)??-1e10;
   const receiveRate=Math.min(12,Math.max(.5,cfg.density*(.2+.35*clamp(cfg.receive))));
   if(now-last<1/receiveRate)continue;
   const v=clamp((event.velocity||.5)*clamp(config.send)*clamp(cfg.receive)*1.65);
   if(v<.035)continue;
   this.lastReceive.set(receiver,now);
   receiver.node.port.postMessage({type:'peerExcite',event:{pad:event.pad,velocity:v,brightness:clamp(event.brightness??.5),pitch:clamp(event.pitch??.5)}});
   const targetStats=this.counters.get(receiver);if(targetStats)targetStats.received++;
  }
 }
 stats(voice){return this.counters.get(voice)||{sent:0,received:0}}
 reset(){for(const voice of this.voices)this.counters.set(voice,{sent:0,received:0});this.lastReceive=new WeakMap();this.lastSend=new WeakMap()}
}
export const peerBus=new PeerBus();
