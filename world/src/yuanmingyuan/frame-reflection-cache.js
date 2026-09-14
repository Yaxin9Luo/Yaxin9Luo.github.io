const scalars=['epoch','renderer','scene','camera','near','far','layers','width','height'];
const matrices=['cameraWorld','cameraProjection','surfaceWorld'];

// A reflector has one colour target. Only its most recent successful view is
// reusable; an earlier camera's entry is invalid after another view overwrites it.
export function createFrameReflectionCache(){
  let last=null;
  function matches(key){
    return last!==null&&scalars.every(name=>last[name]===key[name])&&
      matrices.every(name=>last[name].length===key[name].length&&last[name].every((value,i)=>value===key[name][i]));
  }
  return {
    run(key,capture,{force=false}={}){
      if(!force&&matches(key))return false;
      const next=Object.fromEntries(scalars.map(name=>[name,key[name]]));
      for(const name of matrices)next[name]=Array.from(key[name]);
      // Even a failed render may already have cleared/partly overwritten the
      // target, so an older successful view must not survive a failed attempt.
      last=null;
      capture();
      last=next;
      return true;
    },
    clear(){last=null;},
    get hasValue(){return last!==null;},
  };
}
