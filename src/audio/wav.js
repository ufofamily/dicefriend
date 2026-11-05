export function encodeWav(channels,sampleRate,bits=16){
 if(![16,24].includes(bits)||channels.length!==2||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000||channels[0].length!==channels[1].length)throw Error('Invalid WAV format');
 const frames=channels[0].length,bytes=bits/8,size=frames*2*bytes;if(size>0xffffffff-36)throw Error('WAV exceeds RIFF size');
 const out=new ArrayBuffer(44+size),v=new DataView(out);const text=(offset,s)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i))};
 text(0,'RIFF');v.setUint32(4,36+size,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2*bytes,true);v.setUint16(32,2*bytes,true);v.setUint16(34,bits,true);text(36,'data');v.setUint32(40,size,true);
 let offset=44;for(let i=0;i<frames;i++)for(let c=0;c<2;c++){const value=Number.isFinite(channels[c][i])?Math.max(-1,Math.min(1,channels[c][i])):0;const n=Math.round(value*(value<0?2**(bits-1):2**(bits-1)-1));if(bits===16)v.setInt16(offset,n,true);else{v.setUint8(offset,n&255);v.setUint8(offset+1,(n>>8)&255);v.setUint8(offset+2,(n>>16)&255)}offset+=bytes}return out;
}
