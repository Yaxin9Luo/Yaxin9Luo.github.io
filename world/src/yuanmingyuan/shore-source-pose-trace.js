import * as THREE from 'three';

/** Synchronous diagnostic only. Calls the exact original normalize method;
 * records the pre-normalization vector for the previously captured target.
 * The narrow coordinate window selects observations, never admits geometry.
 * The original method is restored before hashing or any promise can yield. */
export function traceShoreTargetNormalizations(build){
  const original=THREE.Vector3.prototype.normalize,observations=[];let calls=0;
  THREE.Vector3.prototype.normalize=function(){
    const x=this.x,y=this.y,z=this.z,result=original.call(this);calls++;
    if(Math.abs(this.x+.0026656289636253533)<1e-12&&Math.abs(this.y-.9902717558254521)<1e-12&&Math.abs(this.z-.13912132847484032)<1e-12){
      const lengthSquared=x*x+y*y+z*z,length=Math.sqrt(lengthSquared);
      observations.push({input:[x,y,z],diagnosticLengthSquared:lengthSquared,diagnosticSqrt:length,diagnosticReciprocal:1/(length||1),output:this.toArray(),callStack:new Error('normalization observation').stack});
    }
    return result;
  };
  try{return {value:build(),trace:{calls,observations,originalMethodRestoredBeforeAwait:true,method:'Exact source Vector3.normalize called unchanged; pre/post values observed only for the previously captured flower direction'}};}
  finally{THREE.Vector3.prototype.normalize=original;}
}
