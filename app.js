"use strict";
const CFG=window.INVENTARIO_CONFIG||{};
const BASE=CFG.apiBase||'/api/paginas.asmx/';
const $=id=>document.getElementById(id);
let currentUser='', selected=null, busy=false, editingRecordId=null;
const FIELD_GROUPS={
 ident:[['CodigoNuevo','Código nuevo',true],['CodSbn','Código patrimonial'],['Cod2023','Código 2023'],['Cod2025','Código 2025'],['Serie','Serie'],['DescripcionActivo','Descripción del activo',true],['Marca','Marca'],['Modelo','Modelo'],['Observacion1','Observación 1'],['Observacion2','Observación 2'],['Color','Color'],['Largo','Largo'],['Ancho','Ancho'],['Alto','Alto']],
 ubic:[['UbicacionCodigo','Código de ubicación'],['UbicacionDescripcion','Descripción de ubicación'],['CoordinacionArea','Coordinación / área'],['SubunidadServicio','Subunidad / servicio'],['UnidadOrganica','Unidad orgánica'],['UsuarioAsignadoNombre','Usuario asignado'],['Locador','Locador']]
};
const FIELDS=[...FIELD_GROUPS.ident,...FIELD_GROUPS.ubic];
const PICKER_FIELDS=['UbicacionCodigo','UsuarioAsignadoNombre','Locador'];
const pickers={UbicacionCodigo:{store:'ubicaciones',keys:['Codigo','Descripcion'],caption:'Ubicación'},UsuarioAsignadoNombre:{store:'usuarios',keys:['CodigoUsuario','NombreCompleto'],caption:'Usuario asignado'},Locador:{store:'locadores',keys:['CodigoLocador','NombreCompleto'],caption:'Locador'}};
$('fields').innerHTML=Object.entries(FIELD_GROUPS).map(([group,items])=>`<div class="field-group" data-group="${group}">${items.map(([key,label])=>`<label>${label}<input name="${key}" autocomplete="off"></label>`).join('')}</div>`).join('');
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('inventariofw-pwa',3);r.onupgradeneeded=()=>{for(const name of ['masters','records','session','meta','imageCorrections'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function transact(store,mode,fn){const db=await openDB();return new Promise((ok,no)=>{const tx=db.transaction(store,mode),req=fn(tx.objectStore(store));let result; if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>no(req.error)}tx.oncomplete=()=>{db.close();ok(result)};tx.onerror=()=>{db.close();no(tx.error)}})}
const put=(store,item)=>transact(store,'readwrite',s=>s.put(item));
const get=(store,id)=>transact(store,'readonly',s=>s.get(id));
const all=store=>transact(store,'readonly',s=>s.getAll());
async function request(url,init){let r;try{r=await fetch(url,init)}catch(e){throw Error('No se pudo conectar. Revise internet, HTTPS y el proxy/CORS: '+e.message)}if(!r.ok){const errorText=await r.text().catch(()=> '');throw Error('HTTP '+r.status+': '+errorText.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,200))}const txt=await r.text();let j;try{j=JSON.parse(txt)}catch{throw Error('Respuesta no JSON ('+(r.headers.get('content-type')||'sin tipo')+'): '+txt.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,180))};let d=j?.d??j;if(typeof d==='string'){try{d=JSON.parse(d)}catch{}}return d}
function api(method,data){return request(BASE+method,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','Accept':'application/json'},body:JSON.stringify(data)})}
// ASMX devuelve JSON para maestros pero puede devolver XML al recibir formularios.
async function postToma(body){let resp;try{resp=await fetch(BASE+'InsUpdtTomaActivoIsnV2',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'*/*'},body})}catch(e){throw Error('No se pudo conectar al guardar toma: '+e.message)}const text=await resp.text();const description=text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,350);if(!resp.ok)throw Error('Toma HTTP '+resp.status+': '+description);if(!text.trim())throw Error('Toma: respuesta vacía; verificar el registro en SQL Server antes de reintentar');let value;try{const data=JSON.parse(text);value=data?.d??data}catch{if(!/^\s*</.test(text))throw Error('Toma: respuesta inesperada: '+description);const xml=new DOMParser().parseFromString(text,'text/xml');if(xml.querySelector('parsererror'))throw Error('Toma: XML inválido: '+description);const root=xml.documentElement;if(!['string','boolean','int','long'].includes(root.localName))throw Error('Toma: respuesta XML no reconocida: '+description);value=root.textContent.trim()}if(typeof value==='string'){const clean=value.trim();if(/^(false|error|failed|fall[oó]|exception|incorrecto|rechazado)/i.test(clean))throw Error('Servidor rechazó toma: '+clean.slice(0,250));if(clean.startsWith('{')||clean.startsWith('[')){try{value=JSON.parse(clean)}catch{}}else if(!clean)throw Error('Toma: respuesta sin confirmación')}if(value===false||value===null||value?.Success===false||value?.Exito===false||value?.Error||value?.error)throw Error('Servidor rechazó toma: '+JSON.stringify(value));return value}

function rowsOf(d){if(Array.isArray(d))return d;for(const key of ['Table','data','rows','Rows'])if(Array.isArray(d?.[key]))return d[key];throw Error('Formato de maestro no reconocido')}
function show(view){document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==view);$('login').hidden=true;$('app').hidden=false;if(view==='home')renderRecords();if(view==='record')setTab('ident')}
function setTab(tab){document.querySelectorAll('[data-group]').forEach(el=>el.hidden=el.dataset.group!==tab);document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));document.querySelectorAll('[data-photo-group]').forEach(el=>el.hidden=tab!=='fotos');document.querySelectorAll('[data-state-group]').forEach(el=>el.hidden=tab!=='ident')}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function online(){$('connection').textContent=navigator.onLine?'● Conectado':'● Sin conexión'}addEventListener('online',online);addEventListener('offline',online);online();
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(b.dataset.view==='record' && !editingRecordId){$('form').reset();$('recordMode').textContent='Nueva toma'}show(b.dataset.view)});
$('logout').onclick=()=>{currentUser='';$('app').hidden=true;$('login').hidden=false;$('pass').value=''};
function toHex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function passwordKey(pw,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);return toHex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new Uint8Array(salt),iterations:210000,hash:'SHA-256'},key,256))}
$('enter').onclick=async()=>{const u=$('user').value.trim(),pw=$('pass').value;if(!u||!pw)return alert('Ingrese usuario y contraseña');$('enter').disabled=true;try{let ok=false; if(navigator.onLine){const result=await api('ValidarUsuarioSistema',{usuario:u,clave:pw});if(!result?.Autenticado)throw Error('Usuario o contraseña incorrectos o inactivo');const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)));await put('session',{id:'login',user:u,salt,hash:await passwordKey(pw,salt),validatedAt:Date.now()});ok=true}else{const saved=await get('session','login');if(saved?.user!==u||!saved.hash||!saved.salt)throw Error('Primero debe ingresar con internet en este dispositivo');if(await passwordKey(pw,saved.salt)!==saved.hash)throw Error('Contraseña incorrecta');ok=true}if(ok){currentUser=u;$('pass').value='';show('home')}}catch(e){alert('No se pudo iniciar sesión: '+e.message)}finally{$('enter').disabled=false}};
// Scan only the chosen search field. ZXing uses its callback-based camera API on iOS Safari.
let scanStream=null,scanFrame=0,scanActive=false,scanReader=null,scanGeneration=0;
function closeScanner(){
 scanGeneration++;scanActive=false;
 if(scanFrame)cancelAnimationFrame(scanFrame);scanFrame=0;
 if(scanReader){try{scanReader.reset()}catch(e){}scanReader=null}
 if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null}
 const video=$('scanVideo');try{video.pause()}catch(e){}
 if(video.srcObject){try{video.srcObject.getTracks().forEach(t=>t.stop())}catch(e){}}
 video.srcObject=null;$('scanOverlay').hidden=true;
}
function acceptScan(value,target,button){
 if(!value||!scanActive)return;
 closeScanner();
 for(const id of ['search2023','search2025','searchPatrimonial','searchSerie'])$(id).value='';
 $(target).value=String(value).trim();
 $('found').textContent='Código escaneado. Pulsa Buscar activo.';
 $(target).focus();
}
$('scanClose').onclick=closeScanner;
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeScanner()});
document.querySelectorAll('[data-scan]').forEach(button=>button.onclick=async()=>{
 const target=button.dataset.scan;
 if(!navigator.mediaDevices?.getUserMedia){alert('La cámara no está disponible en este navegador.');return}
 if(!('BarcodeDetector' in window)&&!window.ZXing){alert('El lector no se cargó. Conéctate a internet y vuelve a abrir InventarioFW.');return}
 closeScanner();const generation=scanGeneration;
 $('scanOverlay').hidden=false;$('scanStatus').textContent='Abriendo cámara...';
 try{
  const video=$('scanVideo');
  if(!('BarcodeDetector' in window)){
   // ZXing owns the camera stream and reports decoded values through a callback.
   const reader=new ZXing.BrowserMultiFormatReader();
   scanReader=reader;scanActive=true;
   $('scanStatus').textContent='Apunta la cámara al código. Esperando imagen...';
   await reader.decodeFromVideoDevice(undefined,video,(result,error)=>{
    if(generation!==scanGeneration||!scanActive)return;
    if(result){acceptScan(result.getText(),target,button);return}
    if(error&&!(error instanceof ZXing.NotFoundException))$('scanStatus').textContent='Enfoca el QR o código de barras.';
   });
   if(generation!==scanGeneration){reader.reset();return}
   $('scanStatus').textContent='Enfoca el QR o código de barras.';
  }else{
   const formats=await BarcodeDetector.getSupportedFormats();
   const preferred=['qr_code','code_128','code_39','ean_13','ean_8','itf','codabar','upc_a','upc_e','data_matrix','pdf417'].filter(f=>formats.includes(f));
   if(!preferred.length)throw Error('No hay formatos de código compatibles.');
   const detector=new BarcodeDetector({formats:preferred});
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(generation!==scanGeneration){stream.getTracks().forEach(t=>t.stop());return}
   scanStream=stream;video.srcObject=stream;await video.play();
   if(generation!==scanGeneration)return;
   scanActive=true;$('scanStatus').textContent='Enfoca el QR o código de barras.';
   let scanning=false;
   const tick=async()=>{
    if(!scanActive||generation!==scanGeneration)return;
    if(!scanning&&video.readyState>=2){
     scanning=true;
     try{const codes=await detector.detect(video);if(codes.length&&codes[0].rawValue){acceptScan(codes[0].rawValue,target,button);return}}
     catch(e){$('scanStatus').textContent='No se pudo leer: '+e.message}
     finally{scanning=false}
    }
    if(scanActive&&generation===scanGeneration)scanFrame=requestAnimationFrame(tick);
   };
   scanFrame=requestAnimationFrame(tick);
  }
 }catch(e){
  if(generation!==scanGeneration)return;
  closeScanner();alert('No se pudo abrir el escáner: '+e.message);
 }
});
const SEARCH_FIELDS={Cod2023:['Cod2023','Codigo2023'],Cod2025:['Cod2025','Codigo2025','Codigo2020','Cod2020'],CodSbn:['CodSbn','CodigoPatrimonial','CodigoSBN'],Serie:['Serie','NumeroSerie','NroSerie','SerieActivo','NumSerie']};
$('clearSearch').onclick=()=>{for(const id of ['search2023','search2025','searchPatrimonial','searchSerie'])$(id).value='';$('found').textContent=''};
// Optional offline reference for the 5,092 patrimonial assets, keyed independently by each identifier.
let specialAssetsPromise;
async function specialAssets(){
 if(!specialAssetsPromise)specialAssetsPromise=fetch('./activos_especiales_detalle.tsv').then(r=>r.ok?r.text():'').then(t=>{
  const maps={CodSbn:new Map(),Cod2025:new Map(),Cod2023:new Map(),Serie:new Map()};
  for(const line of t.split(/\r?\n/)){const [pat,c25,c23,serie,marca,modelo]=line.split('\t');if(!pat)continue;const item={pat,c25,c23,serie,marca,modelo};
   for(const [field,key] of [['CodSbn',pat],['Cod2025',c25],['Cod2023',c23],['Serie',serie]])if(key)maps[field].set(key.trim().toLocaleLowerCase(),item);
  }return maps;
 }).catch(()=>({CodSbn:new Map(),Cod2025:new Map(),Cod2023:new Map(),Serie:new Map()}));
 return specialAssetsPromise;
}
$('lookup').onclick=async()=>{
 const criteria=[['Cod2023',$('search2023').value.trim()],['Cod2025',$('search2025').value.trim()],['CodSbn',$('searchPatrimonial').value.trim()],['Serie',$('searchSerie').value.trim()]].filter(([,v])=>v);
 if(criteria.length!==1){$('found').textContent='Ingresa solo uno de los cuatro criterios de búsqueda.';return}
 const [field,value]=criteria[0],q=value.toLocaleLowerCase();
 const master=await get('masters','activos');const rows=master?.rows||[];
 selected=rows.find(x=>SEARCH_FIELDS[field].some(k=>String(x[k]??'').trim().toLocaleLowerCase()===q));
 $('found').textContent=selected?'Activo encontrado en maestros locales':'No se encontró el activo en los maestros descargados';
 if(!selected)return;
 const special=(await specialAssets())[field].get(q) || (await specialAssets()).CodSbn.get(String(SEARCH_FIELDS.CodSbn.map(k=>selected[k]).find(Boolean)||'').trim().toLocaleLowerCase()) || (await specialAssets()).Cod2025.get(String(SEARCH_FIELDS.Cod2025.map(k=>selected[k]).find(Boolean)||'').trim().toLocaleLowerCase()) || (await specialAssets()).Cod2023.get(String(SEARCH_FIELDS.Cod2023.map(k=>selected[k]).find(Boolean)||'').trim().toLocaleLowerCase()) || (await specialAssets()).Serie.get(String(SEARCH_FIELDS.Serie.map(k=>selected[k]).find(Boolean)||'').trim().toLocaleLowerCase());
 const form=$('form').elements;
 // Igual que Android: solo datos de identificación; el código nuevo siempre queda vacío.
 form.namedItem('CodigoNuevo').value='';
 for(const [key,aliases] of Object.entries(SEARCH_FIELDS))form.namedItem(key).value=aliases.map(k=>selected[k]).find(v=>v!==null&&v!==undefined)??'';
 for(const [key,aliases] of Object.entries({
  DescripcionActivo:['DescripcionActivo','Descripcion','descripcion'],
  Color:['Color'],Largo:['Largo'],Ancho:['Ancho'],Alto:['Alto']
 }))form.namedItem(key).value=aliases.map(k=>selected[k]).find(v=>v!==null&&v!==undefined)??'';
 const estado=String(selected.EstadoActivo??selected.Estado??'').trim().toUpperCase();
 form.namedItem('EstadoActivo').value=({B:'B',BUENO:'B',R:'R',REGULAR:'R',M:'M',MALO:'M'})[estado]??'';
 // Android special-asset rule: only the listed patrimonial items receive series, brand and model.
 for(const key of ['Serie','Marca','Modelo'])form.namedItem(key).value='';
 if(special){form.namedItem('Serie').value=special.serie||SEARCH_FIELDS.Serie.map(k=>selected[k]).find(Boolean)||'';form.namedItem('Marca').value=special.marca||selected.Marca||'';form.namedItem('Modelo').value=special.modelo||selected.Modelo||''}
 // No modificar ubicación, usuario, locador ni fotografías.
};
$('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const data=Object.fromEntries([...f.entries()].filter(([k])=>!['photo','qr','seriesphoto'].includes(k)));data.Usuario=currentUser;data.EstadoActivo=f.get('EstadoActivo');data.Sit=f.get('Sit')||'EN USO';data.EsTercero=f.has('EsTercero')?'true':'false';if(!data.CodigoNuevo?.trim()){setTab('ident');return alert('Código nuevo obligatorio')}if(!data.DescripcionActivo?.trim()){setTab('ident');return alert('Descripción del activo obligatoria')}if(!data.UbicacionCodigo?.trim()){setTab('ubic');return alert('Seleccione una ubicación')}if(!data.UsuarioAsignadoNombre?.trim()){setTab('ubic');return alert('Seleccione un usuario asignado')}if((!$('photo').files.length&&!((editingRecordId&&await get('records',editingRecordId))?.photos?.[0]))||(!$('qr').files.length&&!((editingRecordId&&await get('records',editingRecordId))?.photos?.[1]))){setTab('fotos');return alert('Foto del activo y foto del QR son obligatorias')}data.Ubicacion=data.UbicacionCodigo;if(data.CodSbn?.length&&data.CodSbn.length!==12&&!confirm('El código patrimonial no tiene 12 caracteres. ¿Guardar igualmente?'))return;const prior=editingRecordId?await get('records',editingRecordId):null;
if(prior?.sentData)return alert('Esta toma ya se envió al servidor y no puede editarse localmente.');
const item=prior||{id:crypto.randomUUID(),remoteId:Math.floor(100000000+Math.random()*899999999),status:'pending',createdAt:new Date().toISOString(),sentData:false,uploaded:[false,false,false],attempts:0};
item.data=data;item.photos=['photo','qr','seriesphoto'].map((id,i)=>$(id).files[0]||prior?.photos?.[i]||null);try{await put('records',item);alert('Inventario y fotografías guardados localmente');e.target.reset();editingRecordId=null;$('recordMode').textContent='Nueva toma';selected=null;$('found').textContent='';show('home')}catch(err){alert('No se pudo guardar: '+err.message)}};
async function editRecord(id){
 const r=await get('records',id);if(!r)return alert('No se encontró la toma');
 if(r.sentData||r.status==='synced')return alert('Esta toma ya fue enviada y no puede modificarse localmente.');
 editingRecordId=id;$('form').reset();
 for(const [key,val] of Object.entries(r.data||{})){const el=$('form').elements.namedItem(key);if(!el)continue;if(el.type==='checkbox')el.checked=val===true||val==='true';else el.value=val??''}
 $('recordMode').textContent='Editando toma '+(r.data.CodigoNuevo||'');$('found').textContent='Las fotografías guardadas se conservan; selecciona archivos solo si deseas reemplazarlas.';
 show('record');
}
$('cancelEdit').onclick=()=>{editingRecordId=null;$('form').reset();$('recordMode').textContent='Nueva toma';show('home')};
async function renderRecords(){
 const rows=await all('records');const pending=rows.filter(x=>x.status!=='synced').length;
 $('stats').textContent=`Total: ${rows.length} · Pendientes: ${pending} · Sincronizados: ${rows.length-pending}`;
 $('records').replaceChildren();
 for(const r of rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))){
  const div=document.createElement('div');div.className='item';
  const label=document.createElement('span');label.textContent=(r.data.CodigoNuevo||r.data.CodSbn||'Sin código')+' — '+(r.status==='synced'?'Sincronizado':r.sentData?'Fotos pendientes':'Pendiente');div.append(label);
  if(!r.sentData&&r.status!=='synced'){const btn=document.createElement('button');btn.type='button';btn.textContent='Editar';btn.onclick=()=>editRecord(r.id);div.append(btn)}
  $('records').append(div)
 }
 if(!rows.length)$('records').textContent='No hay registros locales';
}
function log(s){$('log').textContent+=s+'\n'}
$('syncmasters').onclick=async()=>{if(!navigator.onLine)return alert('Necesitas internet');$('syncmasters').disabled=true;$('log').textContent='';const endpoints=[['usuariosSistema','ObtenerMaestroUsuariosSistema'],['ubicaciones','ObtenerMaestroUbicacionesV2'],['usuarios','ObtenerMaestroUsuarios'],['locadores','ObtenerMaestroLocadores']];try{for(const [id,method] of endpoints){log('Descargando '+id+'...');const rows=rowsOf(await api(method,{}));if(id==='usuariosSistema'&&!rows.length)throw Error('UsuariosSistema vacío');await put('masters',{id,rows,updatedAt:new Date().toISOString()});log('OK: '+rows.length+' registros')}const size=Number(CFG.pageSize)||500;let page=1,total=0,rows=[];while(true){log('Activos, página '+page+'...');const batch=rowsOf(await api('ObtenerMaestroActivosV2',{pagina:page,tamanoPagina:size}));rows.push(...batch);total+=batch.length;log('Activos descargados: '+total);if(batch.length<size)break;if(page++>10000)throw Error('Límite de páginas superado')}await put('masters',{id:'activos',rows,updatedAt:new Date().toISOString()});log('Maestros sincronizados correctamente: '+total+' activos')}catch(e){log('ERROR: '+e.message+'; se conservan los maestros previos.')}finally{$('syncmasters').disabled=false}};

function setupMasterSelectors(){
 for(const [field,meta] of Object.entries(pickers)){
  const input=$('form').elements.namedItem(field);
  input.placeholder='Buscar en maestro local';
  const btn=document.createElement('button');btn.type='button';btn.className='picker-button';btn.textContent='Buscar '+meta.caption.toLowerCase();input.after(btn);if(field==='Locador'){const clear=document.createElement('button');clear.type='button';clear.className='picker-clear';clear.textContent='🗑 Limpiar locador';clear.setAttribute('aria-label','Quitar locador');clear.onclick=()=>{input.value=''};btn.after(clear)}
  btn.onclick=async()=>{const rows=(await get('masters',meta.store))?.rows||[];if(!rows.length)return alert('Sin datos de '+meta.store+'. Utilice Sincronizar maestros primero.');const modal=$('masterPicker'),search=$('pickerSearch'),list=$('pickerResults');$('pickerTitle').textContent='Seleccionar '+meta.caption;modal.hidden=false;search.value=input.value||'';function paint(){const q=search.value.trim().toLocaleLowerCase();list.replaceChildren();const matches=rows.filter(o=>o.Activo!==false&&o.Activo!==0&&meta.keys.some(k=>String(o[k]??'').toLocaleLowerCase().includes(q))).slice(0,75);for(const obj of matches){const item=document.createElement('button');item.type='button';item.className='picker-result';item.textContent=meta.keys.map(k=>obj[k]||'').filter(Boolean).join(' — ');item.onclick=()=>{input.value=field==='UbicacionCodigo'?String(obj.Codigo||''):String(obj.NombreCompleto||'');if(field==='UbicacionCodigo'){const f=$('form').elements;for(const [key,value] of Object.entries({UbicacionDescripcion:obj.Descripcion,CoordinacionArea:obj.CoordinacionArea,SubunidadServicio:obj.SubunidadServicio,UnidadOrganica:obj.UnidadOrganica}))f.namedItem(key).value=value??'';}modal.hidden=true};list.append(item)}if(!matches.length)list.textContent='Sin coincidencias'}search.oninput=paint;paint();search.focus()};
 }
 $('pickerClose').onclick=()=>$('masterPicker').hidden=true;
 $('form').elements.namedItem('UbicacionCodigo').addEventListener('change',async e=>{const rows=(await get('masters','ubicaciones'))?.rows||[];const match=rows.find(r=>String(r.Codigo||'').trim()===e.target.value.trim());if(!match)return;const f=$('form').elements;for(const [key,val] of Object.entries({UbicacionDescripcion:match.Descripcion,CoordinacionArea:match.CoordinacionArea,SubunidadServicio:match.SubunidadServicio,UnidadOrganica:match.UnidadOrganica}))f.namedItem(key).value=val??''});
}
setupMasterSelectors();

const SEND_FIELDS=['CodSbn','Cod2020','CodigoNuevo','Piso','Servicio','Ambiente','ObsAmbiente','DescripcionActivo','DescripcionAdicional','EstadoActivo','Sit','EsTercero','TipoActivo','TipoEquipo','AnioFabricacion','Serie','Color','Modelo','Material','Marca','Largo','Ancho','Alto','FechaVencimiento','Ubicacion','Item','Cantidad','Usuario','Id','Dia','Hora','Lote','UbicacionCodigo','UbicacionDescripcion','UsuarioAsignadoNombre','Locador','Cod2025','Cod2023','Observacion1','Observacion2','CoordinacionArea','SubunidadServicio','UnidadOrganica'];
async function compressPhoto(file){
  if(file.size<900000 && file.type==='image/jpeg')return file;
  if(!(file instanceof Blob)||file.size===0)throw Error('La fotografía guardada está vacía o dañada. Reemplácela desde Actualizar imágenes.');let bitmap;try{bitmap=await createImageBitmap(file)}catch(e){throw Error('No se puede leer la fotografía guardada. Reemplácela desde Actualizar imágenes.')}
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo comprimir fotografía')),'image/jpeg',0.72));
}
async function sendRecord(r){if(!r.sentData){const body=new URLSearchParams();if(!r.remoteId){r.remoteId=Math.floor(100000000+Math.random()*899999999);await put('records',r)}const d={...r.data,Id:r.data.Id||String(r.remoteId),Dia:r.data.Dia||new Date(r.createdAt).toLocaleDateString('es-PE'),Hora:r.data.Hora||new Date(r.createdAt).toLocaleTimeString('es-PE',{hour12:false}),TipoEquipo:''};for(const k of SEND_FIELDS)body.set(k,String(d[k]??''));r.deliveryState='sending-unconfirmed';r.lastError='';await put('records',r);const result=await postToma(body);if(result===false||result===null||result?.Success===false||result?.Exito===false||result?.Error||result?.error)throw Error('Servidor rechazó inventario: '+JSON.stringify(result));r.sentData=true;r.deliveryState='confirmed';r.status='photos-pending';await put('records',r)}for(let i=0;i<r.photos.length;i++){if(!r.photos[i]||r.uploaded[i])continue;const code=r.data.CodigoNuevo;const blob=await compressPhoto(r.photos[i]);const form=new FormData();form.append('file',blob,`${code}_${i+1}.jpg`);form.append('id',`${code}_${i+1}`);const response=await fetch(CFG.imageUpload,{method:'POST',body:form});if(!response.ok){const detail=await response.text();throw Error('Imagen '+(i+1)+': HTTP '+response.status+' '+detail.slice(0,250))}r.uploaded[i]=true;r.photos[i]=null;await put('records',r)}r.status='synced';await put('records',r)}
$('syncpending').onclick=async()=>{if(busy)return;if(!navigator.onLine)return alert('No hay conexión');busy=true;$('syncpending').disabled=true;$('log').textContent='';try{const pending=(await all('records')).filter(r=>r.status!=='synced');const uncertain=pending.filter(r=>!r.sentData&&r.deliveryState==='sending-unconfirmed');if(uncertain.length){log('ATENCIÓN: '+uncertain.length+' tomas tienen envío incierto (la conexión pudo cortarse después de grabar en SQL). No se reenviarán automáticamente para evitar duplicados: '+uncertain.map(r=>r.data.CodigoNuevo).join(', '));}if(!pending.length)return log('No hay registros pendientes');log('Pendientes: '+pending.length);let ok=0,failed=0;for(const r of pending){if(!r.sentData&&r.deliveryState==='sending-unconfirmed'){log('OMITIDA por posible duplicado: '+r.data.CodigoNuevo);continue}try{await sendRecord(r);ok++;log('OK: '+r.data.CodigoNuevo)}catch(e){failed++;r.attempts=(r.attempts||0)+1;r.lastError=e.message;await put('records',r);log('ERROR '+r.data.CodigoNuevo+': '+e.message+(r.deliveryState==='sending-unconfirmed'?' | Verificar en SQL antes de reintentar.':''))}}log(`Finalizado: ${ok} completos; ${failed} pendientes de reintento.`);await renderRecords()}catch(e){log('ERROR GENERAL: '+e.message)}finally{busy=false;$('syncpending').disabled=false}};
// Actualización independiente: solo código nuevo y fotos, sin enviar una nueva toma.
async function sendPhotoSet(job){
 for(let i=0;i<job.photos.length;i++){
  if(!job.photos[i]||job.uploaded[i])continue;
  const blob=await compressPhoto(job.photos[i]);
  const form=new FormData();
  form.append('file',blob,job.code+'_'+(i+1)+'.jpg');
  form.append('id',job.code+'_'+(i+1));
  const response=await fetch(CFG.imageUpload,{method:'POST',body:form});
  if(!response.ok)throw Error('Imagen '+(i+1)+': HTTP '+response.status+' '+(await response.text()).slice(0,250));
  // Free only the successfully uploaded photo; persist after each confirmation.
  job.uploaded[i]=true;
  job.photos[i]=null;
  await put('imageCorrections',job);
 }
 return job.uploaded;
}
$('imageCorrectionForm').onsubmit=async e=>{e.preventDefault();const code=$('correctionCode').value.trim();const photos=['correctionPhoto','correctionQr','correctionSerie'].map(id=>$(id).files[0]||null);if(!code)return alert('Ingrese el código nuevo');if(!photos.some(Boolean))return alert('Seleccione al menos una fotografía');const item={id:crypto.randomUUID(),code,photos,uploaded:[false,false,false],createdAt:new Date().toISOString(),status:'pending'};try{await put('imageCorrections',item);alert('Fotografías guardadas para envío.');e.target.reset()}catch(err){alert('No se pudieron guardar: '+err.message)}};
$('sendCorrections').onclick=async()=>{if(busy)return;if(!navigator.onLine)return alert('Se necesita conexión para enviar imágenes');busy=true;$('sendCorrections').disabled=true;$('correctionLog').textContent='';try{const jobs=(await all('imageCorrections')).filter(x=>x.status!=='synced');for(const job of jobs){try{await sendPhotoSet(job);job.status='synced';job.photos=[null,null,null];await put('imageCorrections',job);$('correctionLog').textContent+='OK: '+job.code+'\\n'}catch(err){job.lastError=err.message;await put('imageCorrections',job);$('correctionLog').textContent+='ERROR '+job.code+': '+err.message+'\\n'}}}finally{busy=false;$('sendCorrections').disabled=false}};
// Export is read-only: never mutates IndexedDB or attempts a network upload.
async function exportTomas(){
 const button=$('exportTomas');button.disabled=true;
 try{
  const records=await all('records');
  if(!records.length){alert('No hay tomas guardadas en este dispositivo.');return}
  const fields=[...new Set(records.flatMap(r=>Object.keys(r.data||{})))].sort();
  const headers=['IdLocal','IdEnvio','FechaRegistro','Estado','DatosEnviados','Intentos','UltimoError','EstadoEntrega','FotoActivoGuardada','FotoQRGuardada','FotoSerieGuardada','FotoActivoEnviada','FotoQREnviada','FotoSerieEnviada',...fields];
  const escapeCSV=v=>{let t=String(v??'');if(/^[=+@-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
  const lines=[headers.map(escapeCSV).join(';')];
  for(const r of records){
   const values=[r.id,r.remoteId,r.createdAt,r.status,r.sentData,r.attempts||0,r.lastError||'',r.deliveryState||'',...[0,1,2].map(i=>r.photos?.[i]?'SI':'NO'),...[0,1,2].map(i=>r.uploaded?.[i]?'SI':'NO'),...fields.map(k=>r.data?.[k]??'')];
   lines.push(values.map(escapeCSV).join(';'));
  }
  const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='InventarioFW_Tomas_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('exportInfo').textContent='Exportación preparada: '+records.length+' tomas. No se alteraron los registros ni las fotografías.';
 }catch(err){alert('Error al exportar tomas: '+err.message)}finally{button.disabled=false}
}
$('exportTomas').onclick=exportTomas;
$('homeSendToma').onclick=()=>{show('sync');$('syncpending').click()};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);
