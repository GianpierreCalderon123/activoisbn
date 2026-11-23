// Preserve raw multipart bytes. Some Vercel runtimes pre-read req.body,
// causing Busboy "Unexpected end of form" when piping an exhausted stream.
const Busboy = require('busboy');
module.exports.config = {api:{bodyParser:false}};
module.exports = async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Only POST'});
 const endpoint=process.env.INVENTARIO_IMAGE_URL || 'https://inventariofw.somee.com/ApiImagenesApp/Image/UploadImage';
 if(!/^https:\/\//i.test(endpoint))return res.status(503).json({error:'INVENTARIO_IMAGE_URL must be an HTTPS URL'});
 let phase='receiving-multipart';
 try{
  const fields=await new Promise((resolve,reject)=>{
   const bb=Busboy({headers:req.headers,limits:{files:1,fileSize:3500000,fields:2}});
   let id='',parts=[],filename='photo.jpg',type='image/jpeg',invalid=false,hasFile=false;
   bb.on('field',(name,value)=>{if(name==='id')id=value});
   bb.on('file',(name,stream,info)=>{
    if(name!=='file'){stream.resume();return}
    hasFile=true;filename=info.filename||filename;type=info.mimeType||type;
    stream.on('data',chunk=>parts.push(chunk));
    stream.on('limit',()=>{invalid=true});
    stream.on('error',reject);
   });
   bb.on('error',reject);
   bb.on('close',()=>{
    if(invalid||!hasFile||!parts.length||!id)return reject(Error('Invalid or oversized image'));
    resolve({id,buffer:Buffer.concat(parts),filename,type});
   });
   // Support both raw Node streams and pre-buffered Vercel request bodies.
   if(Buffer.isBuffer(req.body)){bb.end(req.body)}
   else if(req.body instanceof Uint8Array){bb.end(Buffer.from(req.body))}
   else if(typeof req.body==='string'){bb.end(Buffer.from(req.body,'binary'))}
   else if(req.readableEnded){reject(Error('Multipart body already consumed before upload handler'))}
   else req.pipe(bb);
  });
  if(!/^[\w.-]{1,120}$/.test(fields.id))return res.status(400).json({error:'Invalid image id'});
  phase='forwarding-to-somee';
  const form=new FormData();
  form.append('id',fields.id);
  form.append('file',new Blob([fields.buffer],{type:fields.type}),fields.filename);
  const upstream=await fetch(endpoint,{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
  const result=await upstream.text();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Inventory-Upload-Stage','somee-response');
  return res.status(upstream.status).send(result);
 }catch(err){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Inventory-Upload-Stage',phase);
  return res.status(502).json({error:'Image upload failed',stage:phase,detail:String(err.message)});
 }
};
module.exports.config = {api:{bodyParser:false}};
