import {systems,defaults,toNorm,midiDefaults} from './parameters.js';
import {forensicsCatalog} from './forensicsCatalog.js';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(v)?v:lo));
const frac=(id,n=0)=>((parseInt(id.slice(n,n+7),16)||1)%1009)/1009;
const hz=(r,lo,hi)=>clamp(r.f0||Math.sqrt(clamp(r.centroid||180,30,8000)*60),lo,hi);
const retempo=r=>{const b=r.bpm;if(!b)return 190;return clamp(b<145?b*2:b,145,300)};
function family(r){
 if(r.collection==='TEK Basslines I'||r.collection==='TEK Basslines II')return 'Басовые фактуры';
 if(r.collection==='Ritual Environments')return r.duration>35&&r.events<1000?'Ритуальные атмосферы':r.events>120?'Ритуальные пульсации':'Ритуальные дроны';
 if(r.collection==='TEK Percussions')return r.centroid>2600?'Металлическая перкуссия':'Органическая перкуссия';
 if(r.category==='hat_click_or_noise_hit'||r.category==='percussion_or_fx_one_shot')return 'Короткие удары';
 if(r.category==='tonal_one_shot')return 'Тональные фрагменты';
 if(r.category==='drone_pad_or_tonal_texture'||r.category==='ambience_fx_or_mixed_texture')return 'Экспериментальные атмосферы';
 if(r.category==='rhythmic_kickbass_or_low_loop')return 'Кикбас-лупы';
 return 'Экспериментальная перкуссия';
}
export const forensicCategory = family;
export function forensicEngine(r){
 const f=family(r),u=frac(r.id);
 if(f==='Басовые фактуры')return r.events>8&&r.duration<40?21:u<.72?21:13;
 if(f==='Ритуальные атмосферы'||f==='Ритуальные дроны'||f==='Экспериментальные атмосферы')return r.harmonic>.35&&r.flatness<.18?22:u<.3?13:u<.55?14:u<.75?17:16;
 if(f==='Ритуальные пульсации')return r.low>.33?21:r.events/r.duration>5?18:2;
 if(f==='Органическая перкуссия'||f==='Металлическая перкуссия')return r.events/r.duration>4&&u>.35?23:u<.58?2:18;
 if(f==='Короткие удары')return r.centroid>3000?1:2;
 if(f==='Тональные фрагменты')return r.harmonic>.35?22:2;
 if(f==='Кикбас-лупы')return u<.5?11:23;
 return u<.4?2:u<.72?18:23;
}
function settings(r,os){
 const value=defaults(os);const put=(i,n)=>{const p=systems[os].params[i];value[i]=Number(toNorm(p,clamp(n,p.min,p.max)).toFixed(6))};
 const u=frac(r.id),v=frac(r.id,3),w=frac(r.id,5),bpm=retempo(r);
 const high=clamp(r.high||0,0,1),low=clamp(r.low||0,0,1),flat=clamp(r.flatness||0,0,1),harm=clamp(r.harmonic||0,0,1);
 const length=clamp((r.tail||500)/1000,.04,5),density=clamp(r.events/Math.max(.1,r.duration),.05,20);
 const attack=clamp((r.attack||12)/1000,.003,2),width=clamp(r.width||.25,0,1),ghost=clamp(r.ghost||0,0,1),off=clamp(r.offbeat||0,0,1);
 if(os===1){ // Pulsar: single clicks and high transients
  put(0,clamp(density*1.6+12,12,90));put(1,clamp(r.centroid||900,180,5900));put(2,clamp(attack*.5,.004,.18));put(3,.7+high*.25);put(4,1.4+4*flat);put(5,.06+v*.25);put(6,.25+density*.3);put(7,clamp(.18-ghost*.1,.03,.25));
 }else if(os===2){ // Modal: pitched/inharmonic percussion
  put(0,hz(r,45,820));put(1,clamp(length,.12,4.6));put(2,.15+flat*.55+v*.2);put(3,.12+high*.75);put(4,clamp(density, .3,12));put(5,.12+flat*.65);put(6,clamp(attack,.003,.065));put(7,.02+w*.15);
 }else if(os===13||os===14||os===16||os===17||os===18){ // Ambient/texture engines
  put(0,hz(r,27,1000));put(1,clamp(.035+u*.17+(r.duration>60?.01:.2),.025,3));
  put(2,os===13?clamp(.12+flat*.7,.1,.7):clamp(.12+flat*.78,.1,.91));
  put(3,os===14?clamp(.1+.42*flat+v*.16,.07,.7):os===17?clamp(.03+flat*.28,.01,.35):clamp(.16+harm*.6+v*.16,.1,.9));
  put(4,clamp(length*(r.duration>35?1.6:1),.15,7.2));put(5,clamp(.08+width*.38+v*.12,.02,.7));
  put(6,clamp(.04+u*.28,.02,.4));put(7,clamp(.08+high*.55+w*.22,.03,.8));
 }else if(os===21){ // Slambient bass: rhythmic/slow bass derived from spectral and transient features
  put(0,clamp(bpm,140,320));put(1,hz(r,28,105));put(2,clamp(Math.min(length,.13+u*.18),.025,.8));put(3,clamp(.5+4*flat+.8*v,.1,7));
  put(4,clamp(.25+high*.55+harm*.15,.1,.9));put(5,clamp(.15+.55*high+.2*v,.1,.95));put(6,.04+u*.23);put(7,clamp(.28+density*.065,.2,.93));
 }else if(os===22){ // harmonic pads: tonal source only when heuristics suggest it
  put(0,hz(r,48,520));put(1,.025+u*.23);put(2,clamp(.16+high*.6,.1,.8));put(3,.15+v*.72);put(4,clamp(length*1.3,.2,4.8));put(5,.035+width*.38);put(6,.02+u*.2);put(7,.4+harm*.4);
 }else if(os===23){ // breakbeat is a procedural approximation, not copied drum loop
  put(0,bpm);put(1,hz(r,37,100));put(2,clamp(attack+length*.18,.04,.36));put(3,clamp(.28+high*.62,.2,.9));
  put(4,clamp(.24+off*.46+u*.1,.1,.84));put(5,clamp(.16+ghost*.4+v*.22,.1,.84));put(6,clamp(off*.38,.01,.4));put(7,clamp(.1+ghost*.7,.1,.88));
 }else if(os===11){
  put(0,clamp(bpm,135,235));put(1,hz(r,38,104));put(2,clamp(length*.16,.03,.25));put(3,1+v*4);put(4,.3+low*.55);put(5,.3+high*.6);put(6,clamp(off*.33,0,.4));put(7,.15+u*.6);
 }
 // Shared output: respect brightness and width, cap high-density drive/delay.
 put(8,1.12+clamp(high+.35*flat,0,1)*.7+v*.24);
 put(9,clamp(.18+width*.7,.15,.92));
 put(10,clamp(.035+u*.13,0,.22));
 put(11,clamp((os===23||os===21||os===11?.045:.2)+width*.27+w*.09,0,.65));
 return Object.fromEntries(value.map((x,i)=>[i,x]));
}
const names={
 'Ritual Environments':'Ritual Env','TEK Percussions':'TEK Perc','TEK Basslines I':'TEK Bass I','TEK Basslines II':'TEK Bass II','Phyllorum Horror':'Phyllorum'
};
function displayName(r){
 const source=r.name.match(/(?: - )(\d{1,3})(?:\s|\.|$)/g)||[];
 const no=source.length?source[source.length-1].match(/\d+/)?.[0]:null;
 const tag=(no?no.padStart(2,'0'):r.id.slice(0,4));
 const type=family(r);
 const label=type.includes('Бас')?'Bass':type.includes('перкус')||type.includes('удар')?'Perc':type.includes('атмосфер')||type.includes('дрон')?'Atmos':type.includes('пульс')?'Pulse':'Texture';
 return `${names[r.collection]||'Forensics'} ${tag} · ${label}`.slice(0,40);
}
export const archivedSynthPresets = forensicsCatalog.filter(r=>r.collection!=='Test & Misc').map(r=>{
 const os=forensicEngine(r),genre='Forensics / '+family(r);
 const uncertainty=r.bpm==null?'BPM не определён':`BPM-гипотеза ${r.bpm} (${r.bpmProvenance})`;
 const description=`DSP-реконструкция по анализу «${r.name}»; ${uncertainty}; центроид ${Math.round(r.centroid||0)} Гц, атака ${Math.round(r.attack||0)} мс, событий ${r.events}. Без исходного аудио.`;
 return [displayName(r),os,settings(r,os),{
  genre,description,seed:parseInt(r.id.slice(0,8),16)>>>0,volume:os===21||os===23?.27:.32,
  preferredRole:systems[os].routingRole,midi:midiDefaults(os),
  excitation:{
   character:os===21||os===11?'PULSE':os===23?'GROOVE':os===13||os===22?'DRONE':os===2||os===1?'TEXTURE':'TEXTURE',
   density:clamp(os===13||os===22?.5:r.events/Math.max(1,r.duration)*.7,.3,14),
   response:clamp((r.attack||100)/1000,.04,1.5),
   depth:clamp(.25+(r.active||.4)*.35,.2,.66),
   variation:clamp(.12+(r.ghost||0)*.4+frac(r.id)*.22,.1,.67)
  },
  analysis:{source:r.name,collection:r.collection,hash:r.id,kind:r.category,confidence:r.confidence,bpmHypothesis:r.bpm,bpmProvenance:r.bpmProvenance,
   centroidHz:r.centroid,flatness:r.flatness,attackMs:r.attack,tailMs:r.tail,lowEnergy:r.low,highEnergy:r.high,events:r.events,cycles:r.cycles,pattern:r.patterns}
 }];
});

// Sample FX recipes are not original audio; they process a sample supplied by the user.
// Curated across the archive, capped so the sample dropdown remains navigable.
export const archivedSamplePresets = forensicsCatalog.filter(r=>r.collection!=='Test & Misc')
 .filter((r,i)=>parseInt(r.id.slice(0,3),16)%7===0)
 .slice(0,35).map(r=>{
  const dark=clamp(1-(r.centroid||1200)/8000,0,1),high=clamp(r.high||0,0,1),wide=clamp(r.width||0,0,1);
  const rhythmic=r.events>10&&r.duration<45;
  return [displayName(r).slice(0,36),{
   filter:Math.round(clamp((r.centroid||1200)*3.8,350,16500)), highpass:Math.round(clamp(26+high*650,20,1400)),
   resonance:clamp(.4+high*2.8,.4,4),drive:clamp(.08+high*.24,0,.45),pan:clamp((wide-.4)*.5,-.25,.25),
   grainSize:clamp((r.tail||500)/5000,.025,.45),density:rhythmic?clamp(r.events/Math.max(1,r.duration),2,24):clamp(4+high*12,2,18),
   delayMix:clamp((rhythmic?.08:.22)+wide*.2,0,.47),delayTime:clamp(.18+dark*.75,.08,1.2),delayFeedback:clamp(.15+dark*.38,0,.6),
   attack:clamp((r.attack||60)/1000,.005,1),release:clamp((r.tail||400)/1000,.08,2)
  },{source:r.name,collection:r.collection,hash:r.id}];
 });
