import assert from 'node:assert/strict';
import {synthPresets} from '../src/presets.js';
import {hierarchy} from '../src/presetHierarchy.js';
import {sameCategoryCandidates,chooseCategoryPreset} from '../src/categoryDice.js';
for(let current=0;current<synthPresets.length;current++){
 const items=sameCategoryCandidates(synthPresets,current);
 for(const candidate of items){assert.notEqual(candidate,current);assert.equal(hierarchy(synthPresets[candidate]),hierarchy(synthPresets[current]));}
 for(const draw of [0,1,7,319,4294967295]){
  const selected=chooseCategoryPreset(synthPresets,current,draw);
  assert.equal(items.includes(selected),items.length>0,`selection must remain in category: ${current}`);
 }
}
assert.equal(chooseCategoryPreset(synthPresets,-1,0),null);
assert.throws(()=>chooseCategoryPreset(synthPresets,0,-1));
console.log('PASS category dice: all 233 source categories protected, never same preset, including 32-bit random values');
