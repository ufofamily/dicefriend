export const filterDefaults={type:'OFF',cutoff:12000,q:.707,mix:1};
export const generativeDefaults={source:'OFF',depth:.65,response:.18,density:4,variation:.35,character:'AUTO'};
const range=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export function validExtensions(s){const f=s.frequencyFilter,g=s.generative;return (!f||(['OFF','LP','HP','BP','NOTCH'].includes(f.type)&&range(f.cutoff,20,20000)&&range(f.q,.3,12)&&range(f.mix,0,1)))&&(!g||(['OFF','AUDIO','MIDI'].includes(g.source)&&['AUTO','DRONE','TEXTURE','PULSE','GROOVE','GLITCH'].includes(g.character??'AUTO')&&range(g.depth,0,1)&&range(g.response,.02,2)&&range(g.density,.25,20)&&range(g.variation,0,1)))}
export function extensionDefaults(s){return {...s,frequencyFilter:{...filterDefaults,...s.frequencyFilter},generative:{...generativeDefaults,...s.generative}}}
