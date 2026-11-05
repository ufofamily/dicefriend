export const SMOOTH_SECONDS=.02;
export function automate(param,value,time){param.cancelScheduledValues(time);param.setTargetAtTime(value,time,SMOOTH_SECONDS)}
export const glide=(value,target,sr)=>value+(target-value)*(1-Math.exp(-1/(sr*SMOOTH_SECONDS)));
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
