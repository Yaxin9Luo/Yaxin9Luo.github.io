import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Local development only. No upload endpoint is included in the static website.
export function reviewCapturePlugin(directory=fileURLToPath(new URL('../work/production-v3/captures/',import.meta.url)),{imageDirectory=fileURLToPath(new URL('../images/',import.meta.url))}={}){
  return {name:'local-review-captures',apply:'serve',configureServer(server){
    server.middlewares.use('/images/',async(req,res,next)=>{
      const name=(req.url||'').split('?')[0].replace(/^\//,''),type={webp:'image/webp',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',svg:'image/svg+xml'}[name.split('.').pop()?.toLowerCase()];
      if(!type||!/^[a-z0-9._-]+$/i.test(name)){next();return;}
      try{const data=await readFile(`${imageDirectory}/${name}`);res.setHeader('Content-Type',type);res.end(data);}catch{next();}
    });
    server.middlewares.use('/__review_capture/',async(req,res)=>{
      if(req.method!=='POST'){res.statusCode=405;res.end();return;}
      try{if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.statusCode=403;res.end();return;}}catch{res.statusCode=400;res.end();return;}
      let name;try{name=decodeURIComponent((req.url||'').split('?')[0].replace(/^\//,''));}catch{res.statusCode=400;res.end();return;}
      if(!/^[a-z0-9][a-z0-9._-]{0,200}\.(png|webm|mp4|json|wav)$/i.test(name)){res.statusCode=400;res.end();return;}
      try{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>100*1024*1024){res.statusCode=413;res.end();return;}chunks.push(chunk);}await mkdir(directory,{recursive:true});await writeFile(`${directory}/${name}`,Buffer.concat(chunks),{flag:'wx'});res.end('saved');}
      catch(error){res.statusCode=error.code==='EEXIST'?409:500;res.end(error.code==='EEXIST'?'Evidence name already exists.':'Capture could not be saved.');}
    });
  }};
}
