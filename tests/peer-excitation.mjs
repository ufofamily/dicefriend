import assert from 'node:assert/strict';
import {PeerBus} from '../src/generative/PeerBus.js';
import {SynthCore} from '../src/dsp.js';
import {extensionDefaults,validExtensions} from '../src/generative/settings.js';
const p=(id,settings={})=>({peerId:id,context:{currentTime:0},playing:true,peerConfig:{source:'PEER',density:20,send:1,receive:1,receiveFrom:'ALL',...settings},node:{port:{postMessage(d){this.messages.push(d)},messages:[]}}});
const bus=new PeerBus(),clock={currentTime:1};
const a=p('a'),b=p('b'),c=p('c',{receive:0});a.context=b.context=c.context=clock;
bus.register(a);bus.register(b);bus.register(c);
bus.onEvent(a,{pad:0,velocity:.8});
assert.equal(a.node.port.messages.length,0,'never send to self');
assert.equal(b.node.port.messages.length,1,'receiver responds to source');
assert.equal(c.node.port.messages.length,0,'receive=0 blocks events');
assert(b.node.port.messages[0].event.velocity>0);
bus.onEvent(a,{pad:0,velocity:.8});assert.equal(b.node.port.messages.length,1,'rate limit');
clock.currentTime+=.25;bus.onEvent(a,{pad:1,velocity:.8});assert.equal(b.node.port.messages.length,2);
b.peerConfig.receiveFrom=['different-id'];clock.currentTime+=.25;bus.onEvent(a,{pad:1,velocity:.8});assert.equal(b.node.port.messages.length,2,'target allowlist');
b.peerConfig.receiveFrom=['a'];clock.currentTime+=.25;bus.onEvent(a,{pad:1,velocity:.8});assert.equal(b.node.port.messages.length,3,'selected target');
assert.equal(bus.stats(a).sent,4);assert.equal(bus.stats(b).received,3);
const x=new SynthCore(24000,20,810),y=new SynthCore(24000,20,810);x.setExtensions(extensionDefaults({generative:{source:'PEER',density:10,depth:.7,receive:1,send:1}}));y.setExtensions(extensionDefaults({generative:{source:'PEER',density:10,depth:.7,receive:1,send:1}}));
assert(validExtensions(extensionDefaults({generative:{source:'PEER'}})));
const l=new Float32Array(128),r=new Float32Array(128),aL=new Float32Array(128),aR=new Float32Array(128);
for(let frame=0;frame<12000;frame+=128){x.render(l,r,frame);y.render(aL,aR,frame)}
assert(y.receivePeer({pad:2,velocity:.9,brightness:.8,pitch:.3}));
let difference=0;
for(let frame=12000;frame<18000;frame+=128){x.render(l,r,frame);y.render(aL,aR,frame);for(let i=0;i<128;i++){assert(Number.isFinite(aL[i])&&Math.abs(aL[i])<=.831);difference+=Math.abs(l[i]-aL[i])}}
assert(difference>.05,'incoming peer impulse audibly changes synth');
assert(!y.receivePeer({pad:2,velocity:0}));
console.log('PASS peer bus: no self, mute, allowlists, throttling, tracked delivery, bounded audible impact');
