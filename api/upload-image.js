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
  stage='forwarding-to-somee';
  const form=new FormData();
  form.append('id',id);
  form.append('file',new Blob([buffer],{type:'image/jpeg'}),id+'.jpg');
  const upstream=await fetch(endpoint,{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
  const reply=await upstream.text();
  res.setHeader('X-Inventory-Upload-Stage','somee-response');
  return res.status(upstream.status).send(reply);
 }catch(e){
  res.setHeader('X-Inventory-Upload-Stage',stage);
  return res.status(502).json({error:'Image upload failed',stage,detail:String(e.message)});
 }
};
module.exports.config={api:{bodyParser:false}};
