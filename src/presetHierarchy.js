import {systems} from './parameters.js';
export function hierarchy([name,os,values,meta]){
 const genre=meta.genre;
 if(genre.startsWith('Forensics / '))return 'Анализ семплов › '+genre.slice('Forensics / '.length);
 if(genre==='Psycore')return 'Психоделический › Psycore › Оригинальные движки';
 if(genre.startsWith('Psycore / Slambient'))return 'Психоделический › '+genre.replaceAll(' / ',' › ');
 if(genre==='Liquid DnB')return 'Drum & Bass › Liquid';
 if(genre==='Breakcore')return 'Breakcore › Break edits';
 if(genre==='Ritual psycore')return 'Психоделический › Psycore › Ritual';
 if(genre==='Original')return 'Экспериментальный › Генеративный синтез › '+systems[os].name;
 if(['Harsh Noise','Industrial Atmosphere','Microsound','Noise Ambient'].includes(genre))return 'Экспериментальный › '+({'Harsh Noise':'Noise › Harsh','Industrial Atmosphere':'Industrial › Атмосферы','Microsound':'Microsound › Частицы','Noise Ambient':'Noise › Ambient'}[genre]);
 if(genre==='Ambient / Microsound')return 'Экспериментальный › Microsound › Ambient';
 if(genre==='Ambient / Granular')return 'Экспериментальный › Гранулярный › Ambient';
 if(genre.startsWith('Ambient / '))return genre.replace('Ambient / ','Эмбиент › ');
 if(['Deep Ambient','Isolationist Ambient'].includes(genre))return 'Эмбиент › '+genre;
 if(['Hardtek','Tekkno'].includes(genre))return 'Tekno › '+genre;
 return 'Хардкор › '+(['Speedcore','Splittercore','Extratone'].includes(genre)?'Экстремальный › ':'')+genre;
}
