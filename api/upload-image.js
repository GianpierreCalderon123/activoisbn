// Forward multipart image to the original Android image endpoint.
// Configure INVENTARIO_IMAGE_URL in Vercel as the full HTTPS upload endpoint.
const Busboy = require('busboy');
module.exports = async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Only POST'});
  const endpoint=process.env.INVENTARIO_IMAGE_URL;
  if(!endpoint || !/^https:\/\//i.test(endpoint))return res.status(503).json({error:'Configure INVENTARIO_IMAGE_URL (HTTPS) in Vercel. Original Android endpoint uses HTTP, which must not be exposed as a public proxy without a secured HTTPS gateway.'});
  try{
    const fields=await new Promise((resolve,reject)=>{
      const bb=Busboy({headers:req.headers,limits:{files:1,fileSize:3500000,fields:2}});
      let id='',buffer=[],filename='photo.jpg',type='image/jpeg',invalid=false;
      bb.on('field',(name,value)=>{if(name==='id')id=value});
      bb.on('file',(name,stream,info)=>{if(name!=='file'){stream.resume();return}filename=info.filename||filename;type=info.mimeType||type;stream.on('data',chunk=>buffer.push(chunk));stream.on('limit',()=>invalid=true)});
      bb.on('error',reject);bb.on('finish',()=>invalid||!buffer.length||!id?reject(Error('Invalid or oversized image')):resolve({id,buffer:Buffer.concat(buffer),filename,type}));req.pipe(bb);
    });
    if(!/^[\w.-]{1,120}$/.test(fields.id))return res.status(400).json({error:'Invalid image id'});
    const form=new FormData();form.append('id',fields.id);form.append('file',new Blob([fields.buffer],{type:fields.type}),fields.filename);
    const upstream=await fetch(endpoint,{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
    const result=await upstream.text();res.setHeader('Cache-Control','no-store');return res.status(upstream.status).send(result);
  }catch(err){return res.status(502).json({error:'Image upload failed',detail:String(err.message)})}
};
