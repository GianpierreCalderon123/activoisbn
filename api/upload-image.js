// Receive image bytes directly, avoiding multipart parsing on Vercel.
// Reconstruct multipart only for the existing Somee Android upload endpoint.
module.exports.config={api:{bodyParser:false}};
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Only POST'});
 const endpoint=process.env.INVENTARIO_IMAGE_URL||'https://inventariofw.somee.com/ApiImagenesApp/Image/UploadImage';
 if(!/^https:\/\//i.test(endpoint))return res.status(503).json({error:'INVENTARIO_IMAGE_URL must be HTTPS'});
 const id=String(req.headers['x-inventory-image-id']||'');
 if(!/^[\w.-]{1,120}$/.test(id))return res.status(400).json({error:'Invalid image id'});
 let stage='receiving-image';
 try{
  const parts=[];
  if(Buffer.isBuffer(req.body))parts.push(req.body);
  else if(req.body instanceof Uint8Array)parts.push(Buffer.from(req.body));
  else if(typeof req.body==='string')parts.push(Buffer.from(req.body,'base64'));
  else if(!req.readableEnded){for await(const part of req){parts.push(Buffer.from(part));if(parts.reduce((n,p)=>n+p.length,0)>3500000)throw Error('Image too large')}}
  const buffer=Buffer.concat(parts);
  if(!buffer.length||buffer.length>3500000)return res.status(400).json({error:'Empty or oversized image',bytes:buffer.length});
  const verify=req.headers['x-inventory-verify']==='1';
  const base=process.env.INVENTARIO_IMAGE_READ_BASE;
  if(verify&&(!base||!/^https:\/\//i.test(base)))return res.status(503).json({error:'Verificación R2 no configurada',id});
    stage='forwarding-to-somee';
  const form=new FormData();
  form.append('id',id);
  form.append('file',new Blob([buffer],{type:'image/jpeg'}),id+'.jpg');
  const upstream=await fetch(endpoint,{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
  const reply=await upstream.text();
  res.setHeader('X-Inventory-Upload-Stage','somee-response');
  if(!verify)return res.status(upstream.status).send(reply);
  if(!upstream.ok||/^\s*(ERROR|FALSE)\b/i.test(reply))return res.status(502).json({error:'Carga rechazada',id,detail:reply.slice(0,300)});
  stage='verifying-storage';
  const crypto=require('node:crypto');
  const url=new URL(encodeURIComponent(id)+'.jpg',base.replace(/\/?$/,'/'));
  url.searchParams.set('_verify',crypto.randomUUID());
  const expected=crypto.createHash('sha256').update(buffer).digest('hex');
  for(let attempt=0;attempt<3;attempt++){
   const check=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(5000)});
   if(check.ok&&/^image\//i.test(check.headers.get('content-type')||'')){
    const actual=crypto.createHash('sha256').update(Buffer.from(await check.arrayBuffer())).digest('hex');
    if(actual===expected)return res.status(200).json({verified:true,id,filename:id+'.jpg'});
   }
   if(attempt<2)await new Promise(r=>setTimeout(r,500));
  }
  return res.status(502).json({error:'No se confirmó el archivo exacto en almacenamiento',id});
 }catch(e){
  res.setHeader('X-Inventory-Upload-Stage',stage);
  return res.status(502).json({error:'Image upload failed',stage,detail:String(e.message)});
 }
};
module.exports.config={api:{bodyParser:false}};
