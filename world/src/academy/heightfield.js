// Baked Academy terrain: a 1 m grid replaces the procedural height function,
// so every height query is one bilinear lookup instead of ~6 µs of noise.
export const HEIGHTFIELD={size:401,origin:-200,step:1,offset:25,scale:1000};
export const WATER_LEVEL=-15;

export function createHeightfield(raw,{size,origin,step,offset,scale}=HEIGHTFIELD){
  if(!(raw instanceof Uint16Array)||raw.length!==size*size)throw new Error('Academy terrain data has the wrong size');
  const heights=new Float32Array(raw.length);
  for(let i=0;i<raw.length;i++)heights[i]=raw[i]/scale-offset;
  const max=size-1,extent=origin+max*step;
  function sample(i,j){return heights[Math.min(max,Math.max(0,j))*size+Math.min(max,Math.max(0,i))];}
  function heightAt(x,z){
    if(!(x>origin&&x<extent&&z>origin&&z<extent))return heights[0];
    const fx=(x-origin)/step,fz=(z-origin)/step,i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
    const a=sample(i,j),b=sample(i+1,j),c=sample(i,j+1),d=sample(i+1,j+1);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
  }
  // Unit normal from central differences; writes into `out` ({x,y,z}).
  function normalAt(x,z,out={x:0,y:1,z:0},e=step){
    const nx=heightAt(x-e,z)-heightAt(x+e,z),nz=heightAt(x,z-e)-heightAt(x,z+e),ny=2*e,len=Math.hypot(nx,ny,nz);
    out.x=nx/len;out.y=ny/len;out.z=nz/len;return out;
  }
  return {size,origin,step,extent,heights,heightAt,normalAt,sample};
}
