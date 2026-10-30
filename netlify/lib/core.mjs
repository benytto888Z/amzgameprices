import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const json = (obj, status=200) => new Response(JSON.stringify(obj), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const error = (status, message) => json({error:message},status);
const readJSON = async req => {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Content-Type invalide');
  const text=await req.text(); if(text.length>128000) throw new Error('Requête trop volumineuse');
  return JSON.parse(text);
};
const equal = (a,b) => timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());

// Injection de la source et du stockage pour faciliter les tests.
export function createHandler({seed, getStores, getPassword}) {
  const seedHash=sha(JSON.stringify(seed));
  const versionOf = etag => seedHash + ':' + (etag || 'none');
  const names=seed.equipements.map(x=>x.nom);
  async function current(store){
    const record=await store.getWithMetadata('prix',{type:'json',consistency:'strong'});
    const prices=record?.data?.prices || {};
    const data=structuredClone(seed);
    data.equipements.forEach(g=>{if(Object.prototype.hasOwnProperty.call(prices,g.nom))g.prix_local_fcfa=prices[g.nom]});
    return {data,etag:record?.etag,version:versionOf(record?.etag)};
  }
  // Compteur persistant par adresse IP, avec écriture conditionnelle (fenêtre 15 minutes).
  async function rateLimit(store, ip, password){
    const id=createHmac('sha256',password).update(ip || 'adresse-inconnue').digest('hex');
    const key='limite-'+id; const now=Date.now();
    for(let i=0;i<8;i++){
      const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
      let item=entry?.data;
      if(!item || now-item.start>=15*60*1000) item={start:now,count:0};
      if(item.count>=8) return false;
      const result=await store.setJSON(key,{start:item.start,count:item.count+1}, entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
      if(result.modified) return true;
    }
    return false;
  }
  return async function handler(req,context={}) {
    try {
      const path=new URL(req.url).pathname;
      const {prices,security}=getStores();
      if(path==='/api/catalogue' && req.method==='GET'){
        const v=await current(prices);return json({data:v.data,version:v.version});
      }
      if(path==='/api/login' && req.method==='POST'){
        const password=getPassword();
        if(typeof password!=='string'||password.length<12)return error(503,'Administration non configurée : définissez AMZ_ADMIN_PASSWORD sur Netlify (12 caractères minimum).');
        if(!await rateLimit(security,context.ip,password))return error(429,'Trop de tentatives. Réessayez dans 15 minutes.');
        let payload;try{payload=await readJSON(req)}catch{return error(400,'Requête invalide.')}
        const supplied=payload?.password;
        if(typeof supplied!=='string'||supplied.length>1024||!equal(supplied,password))return error(401,'Mot de passe incorrect.');
        const token=randomBytes(32).toString('base64url');
        await security.setJSON('session-'+sha(token),{expire:Date.now()+8*60*60*1000,passwordVersion:sha(password)});
        return json({token});
      }
      if((path==='/api/prix'||path==='/api/logout') && req.method==='POST'){
        const token=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
        const password=getPassword();
        if(!token||!password||password.length<12)return error(401,'Session administrateur absente ou expirée.');
        const key='session-'+sha(token); const session=await security.get(key,{type:'json',consistency:'strong'});
        if(!session||session.expire<Date.now()||session.passwordVersion!==sha(password))return error(401,'Session administrateur absente ou expirée.');
        if(path==='/api/logout'){await security.delete(key);return json({ok:true})}
        let payload;try{payload=await readJSON(req)}catch{return error(400,'Requête invalide.')}
        if(!payload||typeof payload.version!=='string'||!Array.isArray(payload.prices)||payload.prices.length!==names.length||payload.prices.some(p=>!Number.isSafeInteger(p)||p<0||p>1e12))return error(400,'Liste de prix invalide.');
        const previous=await current(prices);
        if(payload.version!==previous.version)return error(409,'Le catalogue a changé. Rechargez la page avant de modifier.');
        const overrides={};payload.prices.forEach((p,i)=>{if(p!==seed.equipements[i].prix_local_fcfa)overrides[names[i]]=p});
        const result=await prices.setJSON('prix',{prices:overrides},previous.etag?{onlyIfMatch:previous.etag}:{onlyIfNew:true});
        if(!result.modified)return error(409,'Un autre administrateur a enregistré entre-temps. Rechargez la page.');
        return json({ok:true,version:versionOf(result.etag)});
      }
      return error(404,'Route introuvable.');
    }catch(e){console.error('Erreur API catalogue:',e?.message);return error(500,'Service temporairement indisponible. Vérifiez la configuration Netlify et les journaux de fonction.')}
  };
}
