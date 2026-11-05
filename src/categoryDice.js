import {hierarchy} from './presetHierarchy.js';

// A "category" is one visible optgroup, not a similar-looking engine name.
export function sameCategoryCandidates(presets,currentIndex){
 const current=presets[currentIndex];if(!current)return [];
 const group=hierarchy(current);
 return presets.flatMap((p,i)=>i!==currentIndex&&hierarchy(p)===group?[i]:[]);
}
export function chooseCategoryPreset(presets,currentIndex,randomUint32){
 const candidates=sameCategoryCandidates(presets,currentIndex);
 if(!candidates.length)return null;
 if(!Number.isInteger(randomUint32)||randomUint32<0||randomUint32>4294967295)throw Error('Random draw must be uint32');
 return candidates[randomUint32%candidates.length];
}

// The dropdown selects the desired category.  Exclude the preset *actually*
// loaded in this tab (not merely the dropdown option), so a roll always changes
// the sound. When switching category, every item is a valid replacement.
export function replacementCandidates(presets,categoryAnchor,activeIndex){
 const anchor=presets[categoryAnchor];if(!anchor)return [];
 const category=hierarchy(anchor);
 return presets.flatMap((p,i)=>hierarchy(p)===category&&i!==activeIndex?[i]:[]);
}
export function chooseReplacement(presets,categoryAnchor,activeIndex,randomUint32){
 if(!Number.isInteger(randomUint32)||randomUint32<0||randomUint32>4294967295)throw Error('Random draw must be uint32');
 const items=replacementCandidates(presets,categoryAnchor,activeIndex);
 return items.length?items[randomUint32%items.length]:null;
}
