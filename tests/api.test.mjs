import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/lib/core.mjs';
import seed from '../netlify/lib/seed.mjs';
class Store{
  constructor(){this.map=new Map();this.n=0}
  async getWithMetadata(k){return this.map.get(k)??null}
  async get(k){return this.map.get(k)?.data??null}
  async setJSON(k,data,o={}){const old=this.map.get(k);if((o.onlyIfNew&&old)||(o.onlyIfMatch&&old?.etag!==o.onlyIfMatch))return {modified:false};const etag='"'+(++this.n)+'"';this.map.set(k,{data:structuredClone(data),etag});return {modified:true,etag}}
  async delete(k){this.map.delete(k)}
}
const req=(url,method='GET',body,token)=>new Request('https://site.netlify.app'+url,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('catalogue, accès protégé, sauvegarde, conflit, déconnexion',async()=>{
  const stores={prices:new Store(),security:new Store()};
  const handler=createHandler({seed,getStores:()=>stores,getPassword:()=> 'Un-Mot-De-Passe-Long'});
  const call=(url,method='GET',body,token)=>handler(req(url,method,body,token),{ip:'192.0.2.1'});
  let response=await call('/api/catalogue');let initial=await response.json();assert.equal(initial.data.financement.majoration_pourcent,20);assert.equal(initial.data.equipements.length,17);
  let prices=initial.data.equipements.map(g=>g.prix_local_fcfa);prices[0]++;
  assert.equal((await call('/api/prix','POST',{prices,version:initial.version})).status,401);
  assert.equal((await call('/api/login','POST',{password:'mauvais'})).status,401);
  const auth=await(await call('/api/login','POST',{password:'Un-Mot-De-Passe-Long'})).json();assert.ok(auth.token);
  response=await call('/api/prix','POST',{prices,version:initial.version},auth.token);assert.equal(response.status,200);
  assert.equal((await(await call('/api/catalogue')).json()).data.equipements[0].prix_local_fcfa,prices[0]);
  assert.equal((await call('/api/prix','POST',{prices,version:initial.version},auth.token)).status,409);
  assert.equal((await call('/api/logout','POST',{},auth.token)).status,200);
  assert.equal((await call('/api/prix','POST',{prices,version:initial.version},auth.token)).status,401);
});
test('mot de passe manquant désactive l’administration et limitation des connexions',async()=>{
  const stores={prices:new Store(),security:new Store()};let password='';const h=createHandler({seed,getStores:()=>stores,getPassword:()=>password});
  const call=()=>h(req('/api/login','POST',{password:'incorrect'}),{ip:'192.0.2.3'});
  assert.equal((await call()).status,503);password='Un-Mot-De-Passe-Long';for(let i=0;i<8;i++)assert.equal((await call()).status,401);assert.equal((await call()).status,429);
});
